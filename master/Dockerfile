FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

COPY pom.xml .
COPY shared/pom.xml shared/
COPY master/pom.xml master/

RUN apk add --no-cache maven && \
    mvn dependency:go-offline -B

COPY shared ./shared
COPY master ./master

RUN mvn clean package -DskipTests -B

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN addgroup -S dtoe && adduser -S dtoe -G dtoe

COPY --from=builder /app/master/target/*.jar app.jar

RUN chown -R dtoe:dtoe /app

USER dtoe

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
