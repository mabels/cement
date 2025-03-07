import { LoggerImpl } from "@adviser/cement";

export default {
  fetch(): Response {
    // console.log(">>>>enter");
    const logger = new LoggerImpl();
    for (let i = 0; i < 10; i++) {
      logger.Error().Any({ i }).Msg("Hello Logger World!");
    }
    const ret = new Response("Hello World!");
    // console.log(">>>>exit");
    return ret;
  },
};
