package com.chakulasmart;

import com.chakulasmart.config.DatabaseBootstrap;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class ChakulaSmartApplication {

    public static void main(String[] args) {
        // Creates the "chakulasmart" database on the existing Postgres server if it does not exist yet.
        DatabaseBootstrap.ensureDatabaseExists();
        SpringApplication.run(ChakulaSmartApplication.class, args);
    }
}
