package com.suuupra.identity;

import org.junit.platform.suite.api.SelectClasses;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

/**
 * Test Suite for Identity Service
 * Runs all unit and integration tests for the Identity service
 */
@Suite
@SuiteDisplayName("Identity Service Test Suite")
@SelectClasses({
    AuthControllerTest.class,
    UserControllerTest.class,
    UserServiceTest.class,
    AuthControllerIT.class
})
public class IdentityServiceTestSuite {
    // Test suite configuration
}