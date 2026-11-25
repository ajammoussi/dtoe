package com.dtoe.master;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class DtoeMasterApplication {

    public static void main(String[] args) {
        SpringApplication.run(DtoeMasterApplication.class, args);
    }
}
