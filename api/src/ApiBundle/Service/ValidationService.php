<?php

namespace ApiBundle\Service;

class ValidationService {

    private $container;

    public function __construct($container) {
        $this->container = $container;
    }

    public function validateEmail(&$errors, $field, $value) {
        if (empty($value)) {
            return;
        }
        $constraints = array(
            new \Symfony\Component\Validator\Constraints\Email()
        );
        $validationErrors = $this->container->get('validator')->validateValue($value, $constraints);
        if (count($validationErrors) > 0) {
            foreach ($validationErrors as $errorValue) {
                $errors[$field][] = $errorValue->getMessage();
            }
        }
    }

    public function validateRequired(&$errors, $field, $value) {
        $notBlankConstraint = new \Symfony\Component\Validator\Constraints\NotBlank();
        $notBlankConstraint->message = 'Required field.';
        $constraints = array(
            $notBlankConstraint
        );
        $validationErrors = $this->container->get('validator')->validateValue($value, $constraints);
        if (count($validationErrors) > 0) {
            foreach ($validationErrors as $errorValue) {
                $errors[$field][] = $errorValue->getMessage();
            }
        }
    }   
    
    public function validateChoice(&$errors, $field, $value, $options) {
        if(empty($value)) {
            return;
        }
        $choiceConstraint = new \Symfony\Component\Validator\Constraints\Choice();
        $choiceConstraint->choices = $options;
        $constraints = array($choiceConstraint);
        $validationErrors = $this->container->get('validator')->validateValue($value, $constraints);
        if (count($validationErrors) > 0) {
            foreach ($validationErrors as $errorValue) {
                $errors[$field][] = $errorValue->getMessage();
            }
        }
    }

    public function validateRange(&$errors, $field, $min, $max, $value) {
        if (empty($value)) {
            return;
        }
        $rangeConstraint = new \Symfony\Component\Validator\Constraints\Range(array('min' => $min, 'max' => $max));
        $constraints = array($rangeConstraint);
        $validationErrors = $this->container->get('validator')->validateValue($value, $constraints);
        if (count($validationErrors) > 0) {
            foreach ($validationErrors as $errorValue) {
                $errors[$field][] = $errorValue->getMessage();
            }
        }
    }

    public function validateDate(&$errors, $field, $value) {
        if (empty($value)) {
            return;
        }
        $value = new \DateTime($value);
        $dateConstraint = new \Symfony\Component\Validator\Constraints\Date();
        $constraints = array($dateConstraint);
        $validationErrors = $this->container->get('validator')->validateValue($value, $constraints);
        if (count($validationErrors) > 0) {
            foreach ($validationErrors as $errorValue) {
                $errors[$field][] = $errorValue->getMessage();
            }
        }
    }

    public function validateBoolean(&$errors, $field, $value) {
        return $this->validateChoice($errors, $field, $value, array(true, false));
    }

}
