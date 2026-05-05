---

title: c4code-nhsapp-status-handler

---

```mermaid
architecture-beta
    group AppStatusHandler(cloud)[NHSAppStatusHandler]
    service optedOutEvent(aws:res-amazon-eventbridge-event)[channel status PUBLISHED v1 Event]
    service lambda(logos:aws-lambda)[App Status Handler] in AppStatusHandler
    service sqs(logos:aws-sqs)[App Status Queue] in AppStatusHandler
    service ddb(aws:arch-amazon-dynamodb)[Items With TTL] in AppStatusHandler
    service letterReadEvent(aws:res-amazon-eventbridge-event)[DigitalLetterRead Event]
    service letterUnsuccessfulEvent(aws:res-amazon-eventbridge-event)[DigitalLetterUnsuccessful Event]
    junction j1

    optedOutEvent:R --> L:sqs
    sqs:R --> L:lambda
    lambda:B --> T:ddb
    lambda:R -- L:j1
    j1:R --> L:letterReadEvent
    j1:B --> L:letterUnsuccessfulEvent
```
