<?php

namespace ApiBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

class AccessController extends Controller
{
    
    public function requestLoginFormCSRFAction(Request $request) {
        return new Response(json_encode(array('csrf_token' => $this->get('form.csrf_provider')->generateCsrfToken(__CLASS__ . 'login_form'))));
    }
}
