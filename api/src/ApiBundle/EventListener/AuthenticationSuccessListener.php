<?php

namespace ApiBundle\EventListener;

use Lexik\Bundle\JWTAuthenticationBundle\Event\AuthenticationSuccessEvent;
use FOS\UserBundle\Model\UserInterface;

class AuthenticationSuccessListener {

    private $userManager;
    
    public function __construct($userManager) {
        $this->userManager = $userManager;
    }

    /**
     * @param AuthenticationSuccessEvent $event
     */
    public function onAuthenticationSuccessResponse(AuthenticationSuccessEvent $event) {
        
        $data = $event->getData();
        $user = $event->getUser();
        if (!$user instanceof UserInterface) {
            return;
        }
        
        // Get the user init info from the user manager and set it in the event
        $data['data'] = $this->userManager->getUserInitInfo();
        
        $event->setData($data);
    }

}
