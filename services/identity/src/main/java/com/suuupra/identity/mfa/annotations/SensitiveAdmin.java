package com.suuupra.identity.mfa.annotations;

import com.suuupra.identity.mfa.StepUpProtected;
import java.lang.annotation.*;

@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE})
@StepUpProtected
public @interface SensitiveAdmin {}


