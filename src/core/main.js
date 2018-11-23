#!/usr/bin/env node
const logger = require('../support/iunctio-logger');
const express = require('express');
const setup = require('./setup');
const bodyParser = require('body-parser');

function main(){
  try {
    setup();
    const iunctioHomeManager = require('./iunctio-home.manager');
    const app = express();
  
    let iunctioCustomization = iunctioHomeManager.getExpressCustomization();
    if (iunctioCustomization && iunctioCustomization.getCustomLogger) {
      logger.setCustomLogger(iunctioCustomization.getCustomLogger());
    }
  
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
  
    let port = process.env.PORT || 58080;
  
    let apiRouter = express.Router();
    let iunctioSettings = iunctioHomeManager.getSettings();
    let resourcesObj = iunctioHomeManager.getAvailableResources();
  
    let apiBuilder;
    if (iunctioSettings.apiVersion.mode === 'path') {
      apiBuilder = require('./api-builders/path-version-builder');
    } else if (iunctioSettings.apiVersion.mode === 'header') {
      apiBuilder = require('./api-builders/header-version-builder');
    } else {
      throw new Error(`Unsupported apiVersion mode: ${iunctioSettings.apiVersion.mode}`);
    }
    apiBuilder.buildHealthChecks(apiRouter, resourcesObj);
  
    if (iunctioCustomization) {
      if (iunctioCustomization.setupRouterBeforeApi
        && typeof (iunctioCustomization.setupRouterBeforeApi) === 'function') {
        iunctioCustomization.setupRouterBeforeApi(apiRouter);
      } else {
        logger.warn(
          `Found a global Iunctio customization file, but it doesn't export the setupRouterBeforeApi function`,
          'Main',
          'SetupMainRouterBeforeApi'
        );
      }
    }
  
    apiBuilder.buildApi(apiRouter, resourcesObj);
  
    if (iunctioCustomization) {
      if (iunctioCustomization.setupRouterAfterApi
        && typeof (iunctioCustomization.setupRouterAfterApi) === 'function') {
        iunctioCustomization.setupRouterAfterApi(apiRouter);
      } else {
        logger.warn(
          `Found a global Iunctio customization file, but it doesn't export the setupRouterAfterApi function`,
          'Main',
          'SetupMainRouterAfterApi'
        );
      }
    }
  
    app.use('/api', apiRouter);
    app.listen(port);
    logger.info(
      `Iunctio instance is listening on port ${port}`,
      'Main',
      'IunctioStarted'
    );
  } catch (error) {
    logger.error(
      'Unhandled Error',
      'Main',
      'Catch',
      error
    );
    throw error;
  }
}

main();
module.exports = main;