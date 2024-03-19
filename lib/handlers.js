module.exports = (self) => {
  return {
    'apostrophe:ready': {
      async setup () {
        if (!self.options.enabled) {
          if (self.options.debug) {
            self.apos.util.warn('⚠️ Kafka module is disabled.');
          }
          return;
        }

        if (!self.isUsable()) {
          self.apos.util.error('⚠️ Kafka module is not properly configured, it cannot be used.');
          return;
        }

        await self.connectAll();
        await self.emit('topicSubscriptionReady');

        self.apos.util.log(`Kafka: connected to all the clusters and topics (pool size: ${self.pool.size})`);

        for (const [ clusterName, { consumer } ] of self.pool.entries()) {
          if (consumer) {
            await consumer.instance.run(self.consumerRun(clusterName, consumer));
          }
        }

        const errorTypes = [ 'unhandledRejection', 'uncaughtException' ];
        for (const type of errorTypes) {
          process.on(type, async (e) => {
            try {
              await self.disconnectAll();
              self.apos.util.error(`Kafka errorType ${type} exiting`);
              process.exit(0);
            } catch (error) {
              self.apos.util.error(`Kafka errorType ${type} exiting `, error.message);
              process.exit(1);
            }
          });
        }

        const signalTraps = [ 'SIGTERM', 'SIGINT', 'SIGUSR2' ];
        for (const type of signalTraps) {
          process.once(type, async () => {
            try {
              await self.disconnectAll();
            } finally {
              self.apos.util.error(`Kafka signalTraps ${type} exiting`);
              process.kill(process.pid, type);
            }
          });
        }
      }
    },

    'apostrophe:destroy': {
      async disconnect () {
        await self.disconnectAll();
      }
    },

    /**
     * Callback function that manage the error event on message consuming.
     * @param {Object} context clusterName, topic, partition...
     * @param {Object} metadata error context given from the consumer callback function
     */
    consumeErrorHandler: {
      onError (context, metadata) {
        self.onErrorHandler(context, metadata);
      }
    }
  };
};
