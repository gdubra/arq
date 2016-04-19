<?php 
namespace ApiBundle\Service

use ApiBundle\Exception\EntityValidationException;

abstract class BaseEntityManager implements IEntityManager {
	
	protected $em;

	public abstract function getCreateRequiredKeys();
	
	public abstract function validateValues($values);

	public abstract function setValues($entity, $values);
	
	public abstract function newEntityInstance();

	public function find($entityId){
		return $this->getRepo()->find($entityId);
	}

	public function isValidRequest($values, $isNew = true); {
        $requiredKeys = $isNew ? $this->getCreateRequiredKeys():$this->getUpdateRequiredKeys();
        return count(array_intersect_key(array_flip($requiredKeys), $values)) === count($requiredKeys);
    }

    /**
    * By default just the Id is required for update
    * Overwrite if needed
    */
    public function getUpdateRequiredKeys(){
    	return array['id'];
    }

    

    public function validateRequestData($values){
    	$errors = $this->validateValues($values);
    	if(!empty($errors)){
            throw new EntityValidationException($errors);
        }
    }

    public function createFromValues($values){
        $entity = $this->newEntityInstance();
        $this->setValues($entity,$values);
        $this->em->persist($entity);
        $this->em->flush();
        return $entity;
    }
	
	public function updateFromValues($entity,$values){
		$this->setValues($entity,$values);
        $this->em->persist($entity);
        $this->em->flush();
        return $entity;
	}
}