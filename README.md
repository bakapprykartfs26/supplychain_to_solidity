# supplychain_to_solidity
GUI to design a supply chain and convert it to solidity smart contracts. 

## Architecture

<!-- Build System -->
[![Nx](https://img.shields.io/badge/Build%20System-Nx-143055?style=for-the-badge&logo=nx&logoColor=white)](https://nx.dev)

<!-- Language -->
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

<!-- Frontend -->
[![Angular](https://img.shields.io/badge/Frontend-Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.io)

<!-- Backend -->
[![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![NestJS](https://img.shields.io/badge/Framework-NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com)

<!-- Blockchain -->
[![Solidity](https://img.shields.io/badge/Solidity-363636?style=for-the-badge&logo=solidity&logoColor=white)](https://soliditylang.org)

<!-- Bundlers -->
[![esbuild](https://img.shields.io/badge/Bundler%20Frontend-esbuild-FFCF00?style=for-the-badge&logo=esbuild&logoColor=black)](https://esbuild.github.io)
[![Webpack](https://img.shields.io/badge/Bundler%20Backend-Webpack-8DD6F9?style=for-the-badge&logo=webpack&logoColor=black)](https://webpack.js.org)

<!-- Testing -->
[![Jest](https://img.shields.io/badge/Unit%20Tests-Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)](https://jestjs.io)
[![Cypress](https://img.shields.io/badge/E2E%20Frontend-Cypress-69D3A7?style=for-the-badge&logo=cypress&logoColor=black)](https://www.cypress.io)
[![Playwright](https://img.shields.io/badge/E2E%20Frontend-Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev)
[![Jest](https://img.shields.io/badge/E2E%20Backend-Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)](https://jestjs.io)

<!-- Package Manager -->
[![npm](https://img.shields.io/badge/Package%20Manager-npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com)


# Setup development environment

## Clone GitHub project
1. Open console
2. execute `git clone https://github.com/bakapprykartfs26/supplychain_to_solidity.git`
3. Enter your GitHub credentials
4. Done

## Install prerequisites

### Install node.js
1. Check node version: `node --version` should print v20.x.x
2. If your node version is current, you can stop here
3. Install nvm `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash`
4. Restart terminal
5. Run `nvm install 20 && nvm use 20`
6. Verify `node --version` should print v20.x.x
7. Done

### Install nx
1. Install nx globally `npm install -g nx`
2. Install Angular plugin `npm install -D @nx/angular`
3. Install NestJS plugin `npm install -D @nx/nest`

### Install project specific components
1. Install antv `npminstall @antv/x6` 
   - Diagramming / Graph visualization (Used for Supplychain vizualization)
2. Install JSON validater `npm install ajv`
   - Used for Smart-Contract validation
3. Install the class-validator and class transformer plugins `npm install ajv class-validator class-transformer`
4. Install handlebars `npm install handlebars`
   - Templating engine to generate Solidity smart contract code.
5. Install solc `npm install solc`
   - Solidity compiler for Node.js

### Install frontend dependencies
1. Install Cypress `npm install @nx/cypress --save-dev`

### Install backend dependencies
1. Install webpack-cli `npm install webpack-cli --save-dev`