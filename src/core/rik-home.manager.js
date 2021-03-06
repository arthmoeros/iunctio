const fs = require('fs');
const path = require('path');
const jsYaml = require('js-yaml');
const logger = require('../support/rik-logger');

const REGEX_API_VERSION = /v[0-9]*/;
const RESOURCES_FOLDER = 'resources';

class RIKHomeManager {

  initialize(resourcesPath) {
    this.resourcesPath = resourcesPath;
  }

  setSettings(settings) {
    this.settings = settings;
  }

  getResourceConfig(version, name) {
    let resourcePath = path.join(this.resourcesPath, version, RESOURCES_FOLDER, name);
    let ResourceController = require(path.join(resourcePath, 'controller'));
    let resource = {
      resourceController: new ResourceController(),
      metadata: {}
    };

    resource.metadata.name = name;
    resource.metadata.subOf = ResourceController.subOf
    let validationErrors = this._checkResourceControllerFunctions(resource);
    if (validationErrors.length > 0) {
      throw new Error(`Encountered validation errors on resource "${resource.metadata.name}":\n${validationErrors.join('\n')}`);
    }
    resource.metadata.schemas = this._initSchemaFilenames(resourcePath);
    return resource;
  }

  getHealthCheck(version, name) {
    let healthcheckYml = path.join(this.resourcesPath, version, RESOURCES_FOLDER, name, 'healthcheck.yml');
    if (fs.existsSync(healthcheckYml)) {
      return jsYaml.load(fs.readFileSync(healthcheckYml).toString());
    }
    return undefined;
  }

  _initSchemaFilenames(resourcePath) {
    let schemas = {};
    schemas.getRequest = path.join(resourcePath, 'schemas', 'get.request.yml');
    schemas.getResponse = path.join(resourcePath, 'schemas', 'get.response.yml');
    schemas.postRequest = path.join(resourcePath, 'schemas', 'post.request.yml');
    schemas.postResponse = path.join(resourcePath, 'schemas', 'post.response.yml');
    schemas.patchRequest = path.join(resourcePath, 'schemas', 'patch.request.yml');
    schemas.patchResponse = path.join(resourcePath, 'schemas', 'patch.response.yml');
    schemas.deleteRequest = path.join(resourcePath, 'schemas', 'delete.request.yml');
    schemas.deleteResponse = path.join(resourcePath, 'schemas', 'delete.response.yml');
    return schemas;
  }

  _checkResourceControllerFunctions(resource) {
    let validationErrors = [];
    this._checkMethod(resource, 'get', validationErrors);
    this._checkMethod(resource, 'post', validationErrors);
    this._checkMethod(resource, 'patch', validationErrors);
    this._checkMethod(resource, 'delete', validationErrors);
    return validationErrors;
  }

  _checkMethod(resource, method, validationErrors) {
    let resourceController = resource.resourceController;
    if (resourceController[method] !== undefined) {
      if (resourceController[method].length !== 4) {
        validationErrors.push(this._methodArgsErrorMsg(method));
      }
      if (!resourceController[method].toString().startsWith('async')) {
        validationErrors.push(this._methodNotAsyncErrorMsg(method));
      }
    }
  }

  _methodArgsErrorMsg(method) {
    return `The "${method}" method of the ResourceController doesn't expect four arguments`;
  }

  _methodNotAsyncErrorMsg(method) {
    return `The "${method}" method of the ResourceController isn't declared as async`;
  }

  getAvailableResources() {
    const versionsList = fs.readdirSync(this.resourcesPath);
    const resourcesObj = {};
    versionsList.forEach((versionDirName) => {
      if (REGEX_API_VERSION.test(versionDirName)) {
        let versionDirResources = path.join(this.resourcesPath, versionDirName, RESOURCES_FOLDER);
        if (fs.lstatSync(versionDirResources).isDirectory()) {
          resourcesObj[versionDirName] = [];
          let resourcesList = fs.readdirSync(versionDirResources);
          resourcesList.forEach((resourceDirName) => {
            let resourceDir = path.join(versionDirResources, resourceDirName);
            if (fs.lstatSync(resourceDir).isDirectory()) {
              if (fs.existsSync(path.join(resourceDir, 'controller.js'))) {
                resourcesObj[versionDirName].push(resourceDirName);
              } else {
                logger.warn(
                  `Ignoring directory '${path.join(versionDirName, resourceDirName)}' found at resources folder (it lacks a controller.js file)`,
                  'HomeManager',
                  'GetAvailableResources'
                );
              }
            }
          });
        }
      } else {
        logger.warn(
          `Ignoring directory '${versionDirName}' found at rik path (it doesn't have version format)`,
          'HomeManager',
          'GetAvailableResources'
        );
      }
    });
    return resourcesObj;
  }

  getExpressCustomization(versionPath) {
    if (versionPath === undefined) {
      versionPath = '';
    }
    let customizationPath = path.join(this.resourcesPath, versionPath, 'rik-customization');
    if (fs.existsSync(`${customizationPath}.js`)) {
      return require(customizationPath);
    }
    return undefined;
  }

  getSettings() {
    return this.settings;
  }

}

module.exports = new RIKHomeManager();