<?php

namespace ApiBundle\Service;

class JsonSerializationVisitor extends \JMS\Serializer\JsonSerializationVisitor {

	public function getResult() {
		// EXPLICITLY CAST TO ARRAY
		$result = @json_encode ( ( array ) $this->getRoot (), $this->getOptions () );
		
		switch (json_last_error ()) {
			case JSON_ERROR_NONE :
				return $result;
			
			case JSON_ERROR_UTF8 :
				throw new \RuntimeException ( 'Your data could not be encoded because it contains invalid UTF8 characters.' );
			
			default :
				throw new \RuntimeException ( sprintf ( 'An error occurred while encoding your data (error code %d).', json_last_error () ) );
		}
	}
}