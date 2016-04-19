<?php 

namespace ApiBundle\Controller;

use ApiBundle\Exception\EntityValidationException;
use Symfony\Component\HttpFoundation\Request;
use JMS\Serializer\SerializationContext;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;


abstract class BaseEntityController extends \FOS\RestBundle\Controller\FOSRestController {
    
    const ACCESS_GRANTED = 'Access granted';
    
    public function createBadRequestResponse($message = null, $errors = null) {
        if ($message === null && $errors === null) {
            $message = $this->get('translator')->trans('app_bundle.general.malformed_request');
        }
        return $this->createResponse($message, 400, $errors);
    }
    
    public function createAccessDeniedResponse($message = 'Access denied') {
        return $this->createResponse($message, 403);
    }
    
    public function createEntityNotFoundResponse($message = 'Entity not found') {
        return $this->createResponse($message, 422);
    }
    
    public function createResponse($message, $code = 200, $errors = null) {
        $responseParams = array('message' => $message);

        if ($errors !== null) {
            $responseParams['errors'] = $errors;
        }
        return $this->view($responseParams, $code);
    }

    protected function createEntity($request,$paramName,$managerName){
    	$values  = $request->get($paramName);
    	$manager = $this->get($managerName);
        if ($values && $manager->isValidRequest($values)) {
    		try{
    			$manager->validateRequestData($values);
    			$entity = $manager->createFromValues($values);
				$serializationGroup = isset($values['group'])?$values['group']:'edit';
				return $this->view($entity)->setSerializationContext(SerializationContext::create()->setGroups(array($serializationGroup)));
    		}catch(EntityValidationException $e){
    			return $this->createBadRequestResponse(null, $e->getErrors());	
    		}
		}
    	throw new BadRequestHttpException('Bad request');   	
    }

    protected function updateEntity($request,$entityId,$paramName,$managerName){
    	$values  = $request->get($paramName);
    	$manager = $this->get($managerName);
    	$entity  = $manager->find($entityId);
    	if(!$entity){
    		return $this->createEntityNotFoundResponse($this->get('translator')->trans('app_bundle.insurance_policy.not_found'));	
    	}

    	$values['id'] = $entityId;
    	
        if ($values && $manager->isValidRequest($values,false)) {
    		try{
    			$manager->validateRequestData($values);
    			$entity = $manager->updateFromValues($entity,$values);
				$serializationGroup = isset($values['group'])?$values['group']:'edit';
				return $this->view($entity)->setSerializationContext(SerializationContext::create()->setGroups(array($serializationGroup)));
    		}catch(EntityValidationException $e){
    			return $this->createBadRequestResponse(null, $e->getErrors());	
    		}
		}
    	throw new BadRequestHttpException('Bad request');   
    }
	
}