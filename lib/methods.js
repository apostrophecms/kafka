const { Kafka, logLevel } = require('kafkajs');

module.exports = (self) => {
  return {
    isUsable: () => {
      const {
        clusters, clientId, groupId
      } = self.options;

      return clientId &&
        groupId &&
        clusters &&
        !Array.isArray(clusters) &&
        typeof clusters === 'object';
    },

    /**
     * For every cluster configuration in the options, populate
     * the self.pool Map by creating:
     * - A kafka instance
     * - A producer configuration (optional)
     * - A consumer configuration (optional)
     *
     * For now, only support PLAIN/SCRAM connection: https://kafka.js.org/docs/configuration#plain-scram-example
     */
    connectAll: async () => {
      const {
        clusters = {}, clientId, groupId
      } = self.options;

      for (const [ key, config ] of Object.entries(clusters)) {
        if (!self.pool.has(key)) {
          const {
            clusterConnection, consumerConfig, producerConfig, log = 'ERROR'
          } = config;

          if (clusterConnection.ssl === 'true') {
            clusterConnection.ssl = true;
          }

          const instance = new Kafka({
            clientId,
            ...clusterConnection,
            logLevel: logLevel[log]
          });
          const poolObject = { instance };

          if (consumerConfig) {
            const consumer = instance.consumer({
              groupId,
              ...consumerConfig
            });
            await consumer.connect();
            poolObject.consumer = {
              instance: consumer,
              topics: new Map()
            };
          }

          if (producerConfig) {
            const producer = instance.producer(producerConfig);
            await producer.connect();
            poolObject.producer = producer;
          }

          self.pool.set(key, poolObject);

          if (self.options.debug) {
            self.apos.util.log('Kafka dev infos:');
            const admin = instance.admin();
            await admin.connect();
            const topics = await admin.listTopics();
            self.apos.util.log('=> cluster pool size: ', self.pool.size);
            self.apos.util.log('=> topics list: ', topics);
          }
        }
      }
    },

    /**
     * For every consumer in the connection pool, disconnect the consumer
     * if the instance is found. If we already have a disconnectAll running
     * skip it.
     */
    disconnectAll: async () => {
      if (self.isDisconnecting) {
        return;
      }

      self.isDisconnecting = true;
      for (const [ , { consumer } ] of self.pool.entries()) {
        if (consumer?.instance) {
          await consumer.instance.disconnect();
        }
      }
      self.isDisconnecting = false;
    },

    /**
     * This function need to either return an `eachMessage` or an `eachBatch` function.
     * By default lets assume we want to consume the messages with the simplest of both solution: `eachMessage`.
     * See https://kafka.js.org/docs/consuming for more details.
     */
    consumerRun: (clusterName, consumer) => {
      return {
        eachMessage: async (data) => {
          const {
            topic, partition, message
          } = data;

          const context = {
            clusterName,
            topic,
            partition
          };

          const callbacks = consumer.topics.get(topic);
          const messageKey = message.key?.toString();
          const messageValue = message.value?.toString();

          try {
            await Promise.all(callbacks.map((cb) => cb(messageKey, messageValue)));
          } catch (error) {
            const metadata = {
              key: messageKey,
              message: messageValue,
              errorMessage: error.message
            };

            await self.emit('consumeErrorHandler', context, metadata);
          }
        }
      };
    },

    /**
     * Subscribe to a topic and setup the callback function to call once this topic receive a message.
     * This function need to be called in the event handler callback of the module that want to subscribe to a topic.
     *
     * @example
     * // Hook that trigger the callback function once kafka module is ready to receive subscriptions
     * self.on('@dgad/kafka:topicSubscriptionReady', 'subscribeKafkaTopics')
     *
     * @example
     * // Inside self.subscribeKafkaTopics: subscribe to a topic
     * await self.apos.kafka.subscribeTopic('kafka-cluster-01', self.callbackFunctionTest, { topic: 'MY_FIRST_TOPIC' })
     *
     * @param {String} topic
     * @param {CallbackFunc} callbackFunction callback functions to call on message receive
     * @param {Object} subscribeOptions only "topic" or "topics" are mandatory
     */
    subscribeTopic: async (cluster, callbackFunction, subscribeOptions = {}) => {
      if (!self.pool.has(cluster)) {
        self.apos.util.warn(`⚠️ Kafka topic subscribe: ${cluster} cluster is unknown.`);
        return;
      }

      if (!subscribeOptions.topic && !subscribeOptions.topics) {
        self.apos.util.warn('⚠️ Kafka subscribe do not detect any "topic" or "topics" configuration in the subscribeOptions param.');
        return;
      }

      const { consumer } = self.pool.get(cluster);
      await consumer.instance.subscribe(subscribeOptions);

      const topics = subscribeOptions.topic ? [ subscribeOptions.topic ] : subscribeOptions.topics;
      for (const topic of topics) {
        if (!consumer.topics.has(topic)) {
          consumer.topics.set(topic, []);
        }
        consumer.topics.get(topic).push(callbackFunction);
      }
    },

    /**
     * If a producer has been instancied for the target cluster, a message is send through the topic.
     * If no producer instance is found for the cluster, display a warning and return.
     * @param {string} cluster
     * @param {string} topic
     * @param {Array} messages https://kafka.js.org/docs/producing#message-structure
     * @param {Object} [opts] https://kafka.js.org/docs/producing#producing-messages
     */
    produceMessages: async (cluster, topic, messages, opts = {}) => {
      const { producer } = self.pool.get(cluster);
      if (!producer) {
        self.apos.util.warn(`Kafka cannot produce a message, no producer found for the cluser "${cluster}". Please check your cluster configuration.`);
        return;
      }

      await producer.send({
        topic,
        messages,
        ...opts
      });
    },

    /**
     * Log a kafka error
     * @param {Object} context clusterName, topic, partition...
     * @param {Object} metadata error context given from the consumer callback function
     */
    onErrorHandler: (context, metadata) => {
      self.logError('consume', {
        insertDate: new Date(),
        ...context,
        metadata
      });
    }
  };
};
