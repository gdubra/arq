<?php

namespace ApiBundle\Service;

interface IEntityManager{
	
	/**
	* Check if the request has all the needed values set for creation or update
	* @param $values array of pair key/value to be validated
	* @param $isNew flaf to indicate if values are for creation or update
	* @return boolean 
	* @see getUpdateRequiredKeys
	* @see getCreateRequiredKeys
	*/
	public function isValidRequest($values, $isNew = true);

	/**
	* Validates the values for creation or update
	* @param $values array of pair key/value to be validated
	* @throws EntityValidationException in case of errors detected
	*/
	public function validateRequestData($values);
	
	/**
	* @return array of required keys for entity update
	*/
	public function getUpdateRequiredKeys();
	
	/**
	* @return array of required keys for entity creation
	*/
	public function getCreateRequiredKeys();
	
	/**
	* Method used to valdiate data on creation/update entity request form
	* @param $values array of pair key/values
	* @return array of errors
	*/
	public function validateValues($values);

	/**
	* Create a new instance of the managed entity and completes with te values
	* @param $values array of pair key/values
	* @return Instance of Managed Entity 
	* @see newEntityInstance
	* @see setValues
	*/
	public function createFromValues($values);

	/**
	* Updates the instance of the managed entity with the specified values
	* @param $entity Instance of the managed entity
	* @param $values array of pair key/values
	* @return Instance of Managed Entity 
	* @see setValues
	*/
	public function updateFromValues($entity,$values);
	
	/**
	* Completes the entity with the new values
	* @param $entity, entity instance where to be completed
	* @param $values, array of pair key/values to be set
	* @return void
	*/
	public function setValues(&$entity,$values);

	/**
	* Creates a new instance of manahed entity
	* @return a new  empty Instance of the managed entity
	*/
	public function newEntityInstance();

	/**
	* retrives the instance of managed entity by id
	* @param $entityId id of the wanted entity
	* @return Instance of the managed entity
	*/
	public function find($entityId);

	/**
	* get instance of managed entity repo
	* @return Doctrine repo for the managed entity
	*/
	public function getRepo();
}