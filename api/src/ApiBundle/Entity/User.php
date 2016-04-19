<?php

namespace ApiBundle\Entity;

/**
 * User
 */
class User extends \FOS\UserBundle\Entity\User {

    /**
     * @var integer
     */
    protected $id;

    /**
     * @var string
     */
    private $firstName;

    /**
     * @var string
     */
    private $lastName;

    /**
     * @var \DateTime
     */
    private $createdAt;

    /**
     * @var \DateTime
     */
    private $updatedAt;
    
    /**
     * @var \DateTime
     */
    private $welcomeEmailSentAt;

    /**
     * Get id
     *
     * @return integer 
     */
    public function getId() {
        return $this->id;
    }

    /**
     * Set firstName
     *
     * @param string $firstName
     * @return User
     */
    public function setFirstName($firstName) {
        $this->firstName = $firstName;

        return $this;
    }

    /**
     * Get firstName
     *
     * @return string 
     */
    public function getFirstName() {
        return $this->firstName;
    }

    /**
     * Set lastName
     *
     * @param string $lastName
     * @return User
     */
    public function setLastName($lastName) {
        $this->lastName = $lastName;

        return $this;
    }

    /**
     * Get lastName
     *
     * @return string 
     */
    public function getLastName() {
        return $this->lastName;
    }

    public function getFullName() {
        return trim($this->getFirstName()) . ' ' . trim($this->getLastName());
    }

    /**
     * Set createdAt
     *
     * @param \DateTime $createdAt
     * @return User
     */
    public function setCreatedAt() {
        if (!$this->getCreatedAt()) $this->createdAt = new \DateTime();
        if (!$this->getUpdatedAt()) $this->updatedAt = new \DateTime();
        return $this;
    }

    /**
     * Get createdAt
     *
     * @return \DateTime 
     */
    public function getCreatedAt() {
        return $this->createdAt;
    }

    /**
     * Set updatedAt
     *
     * @param \DateTime $updatedAt
     * @return User
     */
    public function setUpdatedAt() {
        $this->updatedAt = new \DateTime();
        return $this;
    }

    /**
     * Get updatedAt
     *
     * @return \DateTime 
     */
    public function getUpdatedAt() {
        return $this->updatedAt;
    }
    
    /**
     * Set welcomeEmailSentAt
     *
     * @param \DateTime $welcomeEmailSentAt
     * @return User
     */
    public function setwelcomeEmailSentAt() {
    	$this->welcomeEmailSentAt = new \DateTime();
    	return $this;
    }
    
    /**
     * Get welcomeEmailSentAt
     *
     * @return \DateTime
     */
    public function getWelcomeEmailSentAt() {
    	return $this->welcomeEmailSentAt;
    }

    public function isAdmin() {
    	return $this->hasRole('ROLE_MANAGER') || $this->hasRole('ROLE_ADMIN');
    }

}
