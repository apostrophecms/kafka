**TODO:** Update the badge URLs for the new module's repo.

<div align="center">
  <img src="https://raw.githubusercontent.com/apostrophecms/apostrophe/main/logo.svg" alt="ApostropheCMS logo" width="80" height="80">

  <h1>Apostrophe Module Template</h1>
  <p>
    <a aria-label="Apostrophe logo" href="https://v3.docs.apostrophecms.org">
      <img src="https://img.shields.io/badge/MADE%20FOR%20ApostropheCMS-000000.svg?style=for-the-badge&logo=Apostrophe&labelColor=6516dd">
    </a>
    <a aria-label="Test status" href="https://github.com/apostrophecms/apostrophe/actions">
      <img alt="GitHub Workflow Status (branch)" src="https://img.shields.io/github/workflow/status/apostrophecms/apostrophe/Tests/main?label=Tests&labelColor=000000&style=for-the-badge">
    </a>
    <a aria-label="Join the community on Discord" href="http://chat.apostrophecms.org">
      <img alt="" src="https://img.shields.io/discord/517772094482677790?color=5865f2&label=Join%20the%20Discord&logo=discord&logoColor=fff&labelColor=000&style=for-the-badge&logoWidth=20">
    </a>
    <a aria-label="License" href="https://github.com/apostrophecms/kafka/blob/main/LICENSE.md">
      <img alt="" src="https://img.shields.io/static/v1?style=for-the-badge&labelColor=000000&label=License&message=MIT&color=3DA639">
    </a>
  </p>
</div>

Introducing `@apostrophecms/kafka`: an open-source module simplifying [Kafka JS](https://kafka.js.org/) integration into Apostrophe CMS. With support for multiple cluster connections, this wrapper streamlines setup, ensuring ease of use and compatibility with Apostrophe's architecture. Developers can seamlessly produce and subscribe to topics from any cluster it is connected to.

## Installation

To install the module, use the command line to run this command in an Apostrophe project's root directory:

```
npm install @apostrophecms/kafka
```

Configure the kafka module in the `app.js` file:

```javascript
require('apostrophe')({
  shortName: 'my-project',
  modules: {
    '@apostrophecms/kafka': {
      options: {
        clusters: {
          /**
           * Wrapper object of the cluster connection configuration.
           * The key is the name of your kafka cluster.
           * This name is arbitrary chosen by yourself and has no impact on the connection itself.
           * @type {Object}
           */
          [KAFKA_CLUSTER_NAME]: {

            /**
             * Only support PLAIN/SCRAM connection for now: https://kafka.js.org/docs/configuration#plain-scram-example
             * Wrapper object that will be directly spread into the the kafkajs constructor class.
             * Check the kafkajs documentation for more informations.
             * @type {Object}
             */
            clusterConnection: {
              /**
               * Broker host (Kafka cluster servers)
               * @type {Array<string>}
               */
              brokers: ['host.docker.internal:9092'],

              /**
               * @type {boolean}
               */
              ssl: <true|false>,

              /**
               * @type {object<{ mechanism, username, password }>}
               */
              sasl: { /* ... */ },
            }

            /**
             * (Optional)
             * If not null: we have to create a consumer for this cluster
             * The object can be empty or can have additional configuration for the
             * kafkajs consumer constructor.
             * @see https://kafka.js.org/docs/consuming#options
             * @type {object|null}
             */
            consumerConfig: {},

            /**
             * (Optional)
             * If not null: we have to create a producer for this cluster
             * The object can be empty or can have additional configuration for the
             * kafkajs producer constructor.
             * @see https://kafka.js.org/docs/producing#message-structure
             * @type {object|null}
             */
            producerConfig: {}

            /**
             * (Optional)
             * Log level, verbosity of kafka, leave it empty for ERROR.
             * https://kafka.js.org/docs/1.11.0/configuration#logging
             * @type {string} INFO | WARN | DEBUG | NOTHING | ERROR
             */
            log: 'ERROR'
          }
        }

        /**
         * Client identifier that needs to be passed when instantiating the kafkajs class.
         * @type {string}
         */
        clientId: '',

        /**
         * In some case you don't want kafka module to be configured, turn this option to false.
         * Example: you are in a dev environment where kafka cluster is not accessible or configured.
         * @type {boolean}
         */
        enabled: <true|false>,

        /**
         * Consumer group id, this option is important if you are running kafka behind a load balancer (kubernetes, AWS elastic beanstalk, etc)
         * This ensure that all your app instances are reading only one time the messages in the topics.
         * Do not generate this id randomly, you have to put a static value here, otherwise the value will be
         * different from a pod to another.
         * @type {string}
         */
        groupId: '',
      }
    }
  }
});
```

## Register to a topic

You can subscribe to a topic from any module of your apos application.

The minimal code needed to register to a topic is:  

```js
handlers: {
  '@apostrophecms/kafka:topicSubscriptionReady': {
    subscribeKafkaTopics: async () => {
      await self.apos.kafka.subscribeTopic('KAFKA_CLUSTER_NAME', self.callbackFunction, { topic: 'YOUR_EVENT_TOPIC' })
    }
  },
},
methods: {
  /**
   * Callback function: called every time a message is received by the kafka consumer in the topic this module is subscribed.
   * @param {string|null} key can be null if the topic is event oriented or string if the topic is entity oriented.
   * @param {string|null} message can be null if the entity need to be deleted. Otherwise the message is a string.
   */
  callbackFunction: async (key, message) => {
    // Do what you want with the key and the message
    // If you need to throw an error, simply throw it with a message:
    // throw new Error('error_message')
  }
}
```

## Produce a message to a topic

As soon as the kafka connection is setup, from any module you can produce a message to a topic, it can easily be done with the following code:

- **cluster**: cluster name (you should find the list in your configuration)
- **topic**: topic name in which you want to send the messages
- **messages**: Please check the kafkajs doc for more details on the `messages` structure: https://kafka.js.org/docs/producing#message-structure
- **options**: Please check the available options on the kafkajs doc: https://kafka.js.org/docs/producing#producing-messages

Example:

```js
const topic = 'YOUR_EVENT_TOPIC'
const cluster = 'KAFKA_CLUSTER_NAME'
const messages = [
  { key: null, value: 'My first message' },
  { key: null, value: 'My second message' }
]
const options = {}

await self.apos.modules['@apostrophecms/kafka'].produceMessages(cluster, topic, messages, options)
```

## Error management

This module is using the [logging system of Apostrophe](https://v3.docs.apostrophecms.org/guide/logging.html#logging-in-apostrophe).

If you want to raise an error inside your callback function, simply throw an error with a message.

```js
throw new Error('error_message')
```

By default the the `onErrorHandler` function is logging the following informations:

```js
{
  clusterName,
  topic,
  partition,
  insertDate,
  metadata: {
    key,
    value,
    errorMessage, // the message that you are throwing from your callback function
  }
}
```

## Local kafka cluster

If you want to setup a local kafka cluster, this module has a turnkey solution for you ! :tada:

A dedicated docker compose file is here for that. All you need to do is to setup this by running the following command:

```sh
docker-compose up -d
```

You can access your cluster UI manager by accessing this URL: `http://localhost:9000` in which you will be able to create your cluster, and all the topics you want.

### :warning: If mutex error on cluster creation

It is possible that you face an issue on cluster creation, to fix it, follow the following instructions:

1. **Connect to the zookeeper**

`docker-compose exec zookeeper sh`

2. **Once you are in the docker container**

Run the following command:

```sh
./bin/zkCli.sh << EOF
  create /kafka-manager/mutex ""
  create /kafka-manager/mutex/locks ""
  create /kafka-manager/mutex/leases ""
EOF
```

### Send messages locally

Connect to the docker kafka container:

`docker-compose exec kafka sh`

#### Produce message without key (null)

```sh
kafka-console-producer.sh \
  --broker-list localhost:9092 \
  --topic YOUR_EVENT_TOPIC
```

Every line is a new message, the key will be automatically null, enter the message like this: `message`.

#### With key

```sh
kafka-console-producer.sh \
  --broker-list localhost:9092 \
  --topic YOUR_ENTITY_TOPIC \
  --property parse.key=true \
  --property key.separator=:
```

Every line is a new key/message, enter the message like this: `key:message`.
