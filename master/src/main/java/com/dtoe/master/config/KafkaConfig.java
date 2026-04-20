package com.dtoe.master.config;

import com.dtoe.shared.message.TaskResultMessage;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.errors.SerializationException;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.serializer.DeserializationException;
import org.springframework.kafka.support.serializer.ErrorHandlingDeserializer;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.util.backoff.FixedBackOff;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class KafkaConfig {

    @Value("${spring.kafka.bootstrap-servers:localhost:9092}")
    private String bootstrapServers;

    @Bean
    public ConsumerFactory<String, TaskResultMessage> taskResultConsumerFactory() {
        Map<String, Object> config = new HashMap<>();
        config.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        config.put(ConsumerConfig.GROUP_ID_CONFIG, "dtoe-master");
        // Results published while the master is down must be processed on restart,
        // and offsets are committed by the container after a successful handle.
        config.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        config.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);

        // The deserializer is configured through its setters below; adding
        // JsonDeserializer.* entries here as well makes Spring Kafka reject the
        // consumer ("configured with property setters, or via configuration
        // properties; not both").
        JsonDeserializer<TaskResultMessage> jsonDeserializer = new JsonDeserializer<>(TaskResultMessage.class);
        jsonDeserializer.setRemoveTypeHeaders(false);
        jsonDeserializer.setUseTypeMapperForKey(false);
        jsonDeserializer.addTrustedPackages("com.dtoe.*");
        jsonDeserializer.ignoreTypeHeaders();

        return new DefaultKafkaConsumerFactory<>(config, new StringDeserializer(),
            new ErrorHandlingDeserializer<>(jsonDeserializer));
    }

    @Bean(name = {"taskResultListenerContainerFactory", "kafkaListenerContainerFactory"})
    public ConcurrentKafkaListenerContainerFactory<String, TaskResultMessage> taskResultListenerContainerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, TaskResultMessage> factory = 
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(taskResultConsumerFactory());

        DefaultErrorHandler errorHandler = new DefaultErrorHandler(new FixedBackOff(1000L, 2L));
        errorHandler.addNotRetryableExceptions(
            DeserializationException.class,
            SerializationException.class,
            IllegalArgumentException.class
        );
        factory.setCommonErrorHandler(errorHandler);

        return factory;
    }
}
