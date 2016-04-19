<?php

namespace ApiBundle\Repository;

use Doctrine\ORM\EntityRepository;

/**
 * DefaultEntityRepository
 *
 */
class DefaultEntityRepository extends EntityRepository {
    
    protected $baseAlias = 'x';

    /**
     * Extension of the doctrine findBy function
     * 
     * @param array $criteria
     * Criteria can be one of 3 kind:
     * 
     * 1) Regular doctrine criteria array
     * e.g. array(
     *          'name' => 'John',
     *          'age' => 30
     *      )
     * 
     * 2) Custom multi-dimensional criteria array
     * e.g. array(
     *          'name' => 'John',
     *          'category' => array(
     *                          'id' => 4
     *                          'color' => array(
     *                                      'id' = 10
     *                                      )
     *                          )
     *      )
     * 
     * 3) Or a mix of an 'allowed filterBy fields' array and an array like 1) or 2)
     * e.g array(
     *          array('name', 'age', 'category')
     *          array(
     *              'name' => 'John',
     *              'age' => 30
     *          )
     *      )
     * NOTE: the allowed filterBy fields array currently supports restricting 
     * direct attributes ('name', 'age) 
     * or first level related entities ('category')
     * 
     * 
     * @param array $orderBy
     * @param type $limit
     * @param type $offset
     * @return type
     */
    public function findBy(array $allowedCriteriaAndCriteria, array $orderBy = null, $limit = null, $offset = null) {
        
        // First normalize allowed criteria + actual criteria into doctrine criteria
        $criteria = $this->getAsDoctrineFilterCriteria($allowedCriteriaAndCriteria);
        
        // Now figure if we are dealing with regular uni-dimensional doctrine criteria array or not
        $regularDoctrineCriteria = true;
        if (count($criteria) > 0) {
            foreach ($criteria as $criteriaKey => $criteriaValue) {
                if (is_array($criteriaValue)) {
                    $regularDoctrineCriteria = false;
                    break;
                }
            }
        }
        
        if ($regularDoctrineCriteria === true) {
            return parent::findBy($criteria, $orderBy, $limit, $offset);
        } else {
            return $this->findByCustomCriteria($criteria, $orderBy, $limit, $offset);
        }
    }
    
    public function findOneBy(array $criteria, array $orderBy = null, $limit = null, $offset = null) {
        $entity = null;
        $results = $this->findBy($criteria, $orderBy, $limit, $offset);
        if (count($results) > 0) {
            if (count($results) == 1) {
                $entity = reset($results);
            } else {
                throw new \Exception('Trying to find one, found more. Make sure you are providing a unique criteria');
            }
        }
        
        return $entity;
    }
    
    protected function getFindByCustomCriteriaQueryBuilder(array $criteria = array(), array $orderBy = null, $limit = null, $offset = null) {
        
        // Build base query
        $qb = $this->createQueryBuilder($this->baseAlias);

        // Add joins and where
        $this->addCriteria($qb, $criteria);

        // Add orderBy
        if (count($orderBy) > 0) {
            foreach ($orderBy as $fieldNameOrKey => $valueOrFieldName) {
                if (is_numeric($fieldNameOrKey)) {
                    $orderByFieldName = $valueOrFieldName;
                    $orderByValue = 'ASC';
                } else {
                    $orderByFieldName = $fieldNameOrKey;
                    $orderByValue = $valueOrFieldName;
                }
                $qb->addOrderBy($this->baseAlias . '.' . $orderByFieldName, $orderByValue);
            }
        }
        
        // Add limit
        if ($limit !== null && is_numeric($limit)) {
            $qb->setMaxResults($limit);
        }
        
        // Add offset
        if ($offset !== null && is_numeric($offset)) {
            $qb->setFirstResult($offset);
        }
        
        // Return query result
        return $qb;
    }

    private function findByCustomCriteria(array $criteria = array(), array $orderBy = null, $limit = null, $offset = null) {
        return $this->getFindByCustomCriteriaQueryBuilder($criteria, $orderBy, $limit, $offset)->getQuery()->getResult();
    }
        
    /* ------ Private functions ------ */

    /**
     * Function to implode a 2 array criteria (allowed fields + submitted values) into a simple doctrine criteria array
     * @param array $criteria This can be either a regular doctrine criteria array or an array with only 2 elements:
     *  - the first one being an array holding the allowed field names
     *  - the second one being a key-value pair array with the keys being the field names to filter by and the values
     *    being the values of the filter
     * @return array a regular doctrine criteria array
     */
    private function getAsDoctrineFilterCriteria($criteria) {
        
        if (count($criteria) == 2 && isset($criteria[0]) && is_array($criteria[0]) && isset($criteria[1]) && is_array($criteria[1])) {
            
            $criteriaArray = array();
            $allowedFilters = $criteria[0];
            $filterValues = $criteria[1];
            
            if (count($allowedFilters) > 0) {
                
                // Go over allowed fields and ignore the rest
                foreach ($allowedFilters as $fieldName) {
                    if (isset($filterValues[$fieldName])) {
                        $criteriaArray[$fieldName] = $filterValues[$fieldName];
                    }
                }
                
            }
            
            // Return the resulting criteria array
            return $criteriaArray;
            
        } else {
            
            // Return the original criteria array
            return $criteria;
            
        }
    }
    
    /**
     * Return list of ids for each entity repository
     */
    public function getIds() {
    	$ids = $this->createQueryBuilder('entity')->getQuery()->getScalarResult();
    	return array_map('current', $ids);
    }
    
    /* ------ Private functions ------ */

    private function addCriteria($qb, $criteria, $parentAlias = 'x') {
        if (is_array($criteria) && count($criteria) > 0) {
            foreach ($criteria as $fieldName => $fieldValueOrJoinSpecCriteria) {
                if (is_array($fieldValueOrJoinSpecCriteria)) {
                    if ($this->isAssociativeArray($fieldValueOrJoinSpecCriteria)) {

                        // Relationship to join and navigate to
                        $qb->leftJoin($parentAlias . '.' . $fieldName, '__' . $fieldName);
                        $this->addCriteria($qb, $fieldValueOrJoinSpecCriteria, '__' . $fieldName);
                        
                    } else {

                        // Property filter with multiple values
                        $uniqueParamName = floor(microtime(true)) * rand(1, 100);
                        $qb->andWhere($parentAlias . '.' . $fieldName . ' IN (?' . $uniqueParamName . ')');
                        $qb->setParameter($uniqueParamName, $fieldValueOrJoinSpecCriteria);
                        
                    }
                } else {

                    // Property filter with 1 value only
                    $qb->andWhere($parentAlias . '.' . $fieldName . ' = :' . $fieldName);
                    $qb->setParameter($fieldName, $fieldValueOrJoinSpecCriteria);
                    
                }
            }
        }
    }

    private function isAssociativeArray(array $array) {
        return count(array_filter(array_keys($array), 'is_string')) > 0;
    }
    
}
