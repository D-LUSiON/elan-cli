# ElAn-CLI

## What is ElAn?

Tired of setting up everything up from scratch when creating your new Electron/Angular application? 
ElAn is here to help you with the whole process because it's the all-in-one solution for creating Electron applications with Angular front-end!

ElAn is an automation CLI script that setups Electron application with Angular front-end, helps running development envirnoment and simplifies build and package process. And you don't need to remember all available options because most of the process is navigated through interactive menu.

## Installation

Install ElAn as global dependency:

```npm install -g elan-cli```

## Usage

You can use following commands:

**elan init [your-project-name]** - creates a new project and setups it

**elan serve [?project-name]** - starts dev environment so you can develop your app

**elan build [?project-name]** - builds the app for production

**elan help [?command]** - displays help on commands

**elan version** - displays versions of globaly installed ElAn, Electron and Angular CLI or sets version of the local ElAn project

*For more information type `elan help` in the console*

## Working functionality
*(tested only on Windows 10 and Ubuntu 18.04)*

- Creation of a project with **elan init [?project-name]**
- Serving in development mode with **elan serve [?project-name]**
- Building with **elan build [?project-name]**
- Support for multi-project Angular front-end
- Electron TypeScript support
- Initialize Electron template. For now there are only two - vanilla JS and TypeScript.

## Planned functionality

- Write proper documentation
- Init Angular multi-project
- Create resources from image for compiler
- Setup if project uses local index.html or loads Express http server
- Electron wrapper library with pre-defined classes

## Credits

I'd like to thank all these hard working people and their open source projects because ElAn will not be possible without them:

- [NodeJS](https://nodejs.org/)
- [Electron](https://electronjs.org/)
- [Angular](https://angular.io/)
- [Electron builder](https://www.electron.build/)
- [Inquirer](https://github.com/SBoudrias/Inquirer.js)
- [Nodemon](https://nodemon.io/)
- and all other that this projects depend on...

## Issues and Contribution

If you like what I've done so far, star the project to help it reach more people!

If you have ideas or you've found bugs, use the [issue tracker](https://github.com/D-LUSiON/elan-cli/issues) to share them with me!