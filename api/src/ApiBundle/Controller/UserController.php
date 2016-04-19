<?php

namespace ApiBundle\Controller;

use ApiBundle\Entity\User;
use Symfony\Component\HttpFoundation\Request;
use JMS\Serializer\SerializationContext;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

class UserController extends BaseEntityController {

    public function getUserAction(Request $request, $userId) {
        $group   = !empty($request->get('group')) ? $request->get('group') : 'edit';
        $user = $this->get('user_manager')->findUserBy(array('id' => $userId));
        return $this->view($user)->setSerializationContext(SerializationContext::create()->setGroups(array($group)));
    }
    
    public function getUsersAction(Request $request) {
        $group   = !empty($request->get('group')) ? $request->get('group') : 'index';
        $filters = !empty($request->get('filters')) ? json_decode($request->get('filters'), true) : array();
        $orderBy = !empty($request->get('orderBy')) ? json_decode($request->get('orderBy'), true) : array();
        $users   = $this->get('user_manager')->findBy($filters, $orderBy);
        return $this->view($users)->setSerializationContext(SerializationContext::create()->setGroups(array($group)));
    }

    public function deleteUserAction($userId) {
        $entity = $this->get('user_manager')->findUserBy(array('id' => $userId));
        if($this->get('user_manager')->getLoggedUser()->getId() == $userId) {
        	return $this->createBadRequestResponse('Is not possible to remove the logged in user');
        }
        if ($entity !== null) {
        	$userName = $entity->getFullName();
            $this->get('user_manager')->deleteUser($entity);
            return $this->view(array('message' => $this->get('translator')->trans('app_bundle.user.deleted', array('%full_name%' => $userName))));
        } else {
            return $this->view(array('message' => 'app_bundle.user.not_found'), 422);
        }
    }

    public function getAllExistingUserRolesAction($_route) {
        return $this->get('user_manager')->getExistingRoles();
    }

    /*
     * Creates an user 
     */
    public function createUserAction(Request $request) {
    	return $this->createEntity($request,'user','user_manager');
    }
    
    /*
     * Updates an user
     */
    public function updateUserAction($userId, Request $request) {
        return $this->updateEntity($request,$userId,'user','user_manager');	
    }
    
    /**
     * Checks if the confirmation token is valid
     */
    public function checkPasswordResetTokenAction($token) {
    	$user = $this->container->get('fos_user.user_manager')->findUserByConfirmationToken($token);
    	if (null === $user) {
    		return $this->createBadRequestResponse("You've already set up your password.");
    	}
    	if (!$user->isPasswordRequestNonExpired($this->container->getParameter('fos_user.resetting.token_ttl'))) {
    		return $this->createBadRequestResponse('The reset password token has expired, please request a new one.');
    	}
    	return array('token' => $token, 'csrfToken' => $this->get('user_manager')->generateRessettingCsrfToken());
    }
    
    /**
     * Resets the password with the received token and logs the user into the system.
     */
    public function resetPasswordAndAuthenticateUserAction($token) {
    	$user = $this->container->get('fos_user.user_manager')->findUserByConfirmationToken($token);
    	if (null === $user) {
    		throw new $this->createBadRequestResponse('Unable to reset your password, please try again doing the reset password process.');
    	}
    	if (!$user->isPasswordRequestNonExpired($this->container->getParameter('fos_user.resetting.token_ttl'))) {
    		throw new $this->createBadRequestResponse('The reset password token has expired, please request a new one.');
    	}
    	$form = $this->container->get('fos_user.resetting.form');
    	$formHandler = $this->container->get('fos_user.resetting.form.handler');
    	$process = $formHandler->process($user);
    	if ($process) {
    		$userManager = $this->get('user_manager');
    		$token = $userManager->authenticateUser($user);
    		$view = $this->view(array(
    			'data' => $userManager->getUserAndHouseholdInitInfo(),
    			'token' => $token
    		));
    		return $view;
    	} else {
    		return $this->view($form, 400);
    	}
    }

}
