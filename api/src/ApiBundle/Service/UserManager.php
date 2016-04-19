<?php

namespace ApiBundle\Service;

use \FOS\UserBundle\Util\CanonicalizerInterface;
use \Symfony\Component\Security\Core\Encoder\EncoderFactoryInterface;
use ApiBundle\Entity\User;
use Doctrine\ORM\EntityManager;
use Symfony\Component\Security\Core\SecurityContext;
use ApiBundle\Entity\User as AssociatedUser;
use Lexik\Bundle\JWTAuthenticationBundle\Security\Authentication\Token\JWTUserToken;
use ApiBundle\Exception\EntityValidationException;

class UserManager extends \FOS\UserBundle\Doctrine\UserManager implements IEntityManager {

    private $fosUserEntityManager;
    private $entityManager;
    private $securityContext;
    private $formCsrfProvider;
    private $container;
    private $validationService;
    
    public function __construct(
        $class, EncoderFactoryInterface $encoderFactory,
    	CanonicalizerInterface $usernameCanonicalizer, $emailCanonicalizer, 
    	EntityManager $fosUserEntityManager, 
        EntityManager $entityManager,
    	SecurityContext $securityContext,
    	$formCsrfProvider,
    	$container,$validationService) {
        
        parent::__construct($encoderFactory, $usernameCanonicalizer, $emailCanonicalizer, $entityManager, $class);
        $this->fosUserEntityManager = $fosUserEntityManager;
        $this->securityContext      = $securityContext;        
        $this->formCsrfProvider     = $formCsrfProvider;
        $this->container            = $container;
        $this->entityManager        = $entityManager;
        $this->validationService    = $validationService;
    }

    public function getRepo(){
       return $this->entityManager->getRepository('ApiBundle:User'); 
    }

    /*
     * This method doesn't admin filtering by 'role' and also setting up other fileters nor orderBy, limit or offset
     */
    public function findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null) {
        if (isset($criteria['role'])) {
            return $this->entityManager->getRepository('ApiBundle:User')->findByRole($criteria, $orderBy, $limit, $offset);
        } else {
            return $this->entityManager->getRepository('ApiBundle:User')->findBy($criteria, $orderBy, $limit, $offset);
        }
    }

    public function getLoggedUser() {
        if ($this->securityContext->getToken() !== null) {
            return $this->securityContext->getToken()->getUser();
        } else {
            throw new \Exception('User not logged in, not logged in yet, or security context token not setup yet');
        }
    }

    public function newEntityInstance(){
        return new User();
    }
    
    public function getExistingRoles() {
        return array_keys($this->container->getParameter('security.role_hierarchy.roles'));
    }
    
    public function getExistingRolesAsArrayIndex() {
        $returnArray = array();
        $existingRolesArray = $this->getExistingRoles();
        if (count($existingRolesArray) > 0) {
            foreach ($existingRolesArray as $existingRole) {
                $returnArray[$existingRole] = true;
            }
        }
        return $returnArray;
    }

    public function saveUser($entity) {
        $this->fosUserEntityManager->persist($entity);
        $this->fosUserEntityManager->flush();
    }

    public function generateLoginCsrfToken() {
        return $this->formCsrfProvider->generateCsrfToken('authenticate');
    }
    
    public function generateRessettingCsrfToken() {
    	return $this->formCsrfProvider->generateCsrfToken('resetting');
    }

    public function validateValues($values) {
        $errors = array();
        //Fields validation
        if (isset($values['email'])) {
            $this->validationService->validateRequired($errors, 'email', $values['email']);
            $this->validationService->validateEmail($errors, 'email', $values['email']);
            $user = $this->findUserByEmail($values['email']);
            if($user) {
                $errors['email'][] = 'This email address is already in use.';
            }
        }
        if (isset($values['firstName'])) {
            $this->validationService->validateRequired($errors, 'firstName', $values['firstName']);
        }
        if (isset($values['lastName'])) {
            $this->validationService->validateRequired($errors, 'lastName', $values['lastName']);
        }
        
        return $errors;
    }

    public function isValidRequest($values, $isNew = true){
        $requiredKeys = $isNew ? $this->getCreateRequiredKeys():$this->getUpdateRequiredKeys();
        return count(array_intersect_key(array_flip($requiredKeys), $values)) === count($requiredKeys);
    }

    public function validateRequestData($values){
        $errors = $this->validateValues($values);
        if(!empty($errors)){
            throw new EntityValidationException($errors);
        }
    }

    public function find($entityId){
        return $this->getRepo()->find($entityId);
    }

    public function setValues(&$user, $values) {
        if(!$user->getId()){
            $generatedPassword = substr($this->tokenGenerator->generateToken(), 0, 12);
            $user->setPlainPassword($generatedPassword);
        }

        if(isset($values['role'])){
            $user->addRole($values['role']);
        }
        if(isset($values['email'])) {
            $user->setEmail($values['email']);
            $user->setUsername($values['email']);
        }
        if(isset($values['enabled'])) {
            $user->setEnabled($values['enabled']);
        }
        if(isset($values['firstName'])) {
            $user->setFirstName($values['firstName']);
        }
        if(isset($values['lastName'])) {
            $user->setLastName($values['lastName']);
        }
    }

    public function createFromValues($values){
        $user = new User();
        $this->setValues($user,$values);
        
        $protocol = isset($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] != "on" ? 'https' : 'http';
        $baseUrl = $protocol . '://' . $_SERVER['SERVER_NAME'] . '/setup-password/';
        $this->sendWelcomeEmail($user, $baseUrl);
        $this->updateUser($user);
        $this->reloadUser($user);
        return $user;
    }

    public function updateFromValues($user,$values){
        $this->setValues($user,$values);
        $this->updateUser($user);
        $this->reloadUser($user);
        return $user;   
    }

    public function getUpdateRequiredKeys(){
        return array('id');
    }

    public function getCreateRequiredKeys(){
        return array('role', 'email');
    }
        
    public function authenticateUser($user) {
    	$jwt_manager = $this->container->get('lexik_jwt_authentication.jwt_manager');
    	$user->setLastLogin(new \DateTime());
    	$this->updateUser($user);
    	$token = $jwt_manager->create($user);
    	$tokenInterface = new JWTUserToken($user->getRoles());
    	$tokenInterface->setUser($user);
    	$tokenInterface->setRawToken($token);
    	$this->securityContext->setToken($tokenInterface);
    	return $token;
    }
    
    /*
     * Function to get all the user init data when logging in
     */
    public function getUserInitInfo() {
        $user = $this->getLoggedUser();
        $data = array(
            'id' => $user->getId(),
            'roles' => $user->getRoles(),
            'username' => $user->getUsername(),
            'name' => $user->getFullName()
        );
        return $data;
    }

}
