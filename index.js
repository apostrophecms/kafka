const methods = require('./lib/methods');
const handlers = require('./lib/handlers');

module.exports = {
  options: {
    label: 'Kafka',
    ignoreNoCodeWarning: true,
    debug: process.env.NODE_ENV !== 'production'
  },

  methods,
  handlers,

  init(self) {
    /**
     * A Kafka consumer object wrapper object config.
     * The topics Map contain the information of wich topic we need to listen to and
     * also which callback function(s) we need to call once a message is received.
     * @typedef {
     *   {
     *     instance: Kafka.consumer,
     *     topics: Map<String, Array<callback>>,
     *   }
     * } KafkaConsumer
     */

    /**
     * Map of Object with kafka instances, consumer and producer.
     * One entry per cluster connection configuration.
     * @type {
     *   Map<String, { instance: Kafka, consumer: KafkaConsumer, producer: Kafka.producer }>
     * }
     */
    self.pool = new Map();
  }
};
