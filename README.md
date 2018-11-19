# node-get-app-root-path

Gets a node application or workspace root path.
Provides environment and modules information and utilities.

# API

# Table of contents

- [getAppRootPath][sourcefile-0]
  - Interfaces
    - [AppRootPath][interfacedeclaration-0]
    - [IPackageManifest][interfacedeclaration-1]

# getAppRootPath

## Interfaces

### AppRootPath

getAppRootPath function

```typescript
interface AppRootPath {
  (): string
  readonly isLambda: boolean
  isLocal: boolean
  isTesting: boolean
  readonly isGitRepo: boolean
  readonly manifest: IPackageManifest
  readonly env: ProcessEnv
  readonly initialCwd: string
  path: string
  getIsLocal(): boolean
  setIsLocal(value: string | boolean): void
  getIsTesting(): boolean
  setIsTesting(value: string | boolean): void
  getPath(): string
  setPath(value: string): void
  shortenPath(p: string, rootDir?: string | undefined): string
  coreModule<Module extends NodeModule>(module: Module): Module
  executableModule<Module extends NodeModule>(module: Module, functor: () => never | void | Promise<any>): Module
}
```

#### Call

```typescript
(): string;
```

**Return type**

string

#### Method

```typescript
getIsLocal(): boolean;
```

**Return type**

boolean

```typescript
setIsLocal(value: string | boolean): void;
```

**Parameters**

| Name  | Type                  | Description        |
| ----- | --------------------- | ------------------ |
| value | string &#124; boolean | The boolean value. |

**Return type**

void

```typescript
getIsTesting(): boolean;
```

**Return type**

boolean

```typescript
setIsTesting(value: string | boolean): void;
```

**Parameters**

| Name  | Type                  | Description        |
| ----- | --------------------- | ------------------ |
| value | string &#124; boolean | The boolean value. |

**Return type**

void

```typescript
getPath(): string;
```

**Return type**

string

```typescript
setPath(value: string): void;
```

**Parameters**

| Name  | Type   | Description               |
| ----- | ------ | ------------------------- |
| value | string | The new root folder path. |

**Return type**

void

```typescript
shortenPath(p: string, rootDir?: string | undefined): string;
```

**Parameters**

| Name    | Type                    | Description                                  |
| ------- | ----------------------- | -------------------------------------------- |
| p       | string                  | The path to shorten.                         |
| rootDir | string &#124; undefined | The root dir, by default is getAppRootPath() |

**Return type**

string

```typescript
coreModule<Module extends NodeModule>(module: Module): Module;
```

**Type parameters**

| Name   | Constraint |
| ------ | ---------- |
| Module | NodeModule |

**Parameters**

| Name   | Type   | Description   |
| ------ | ------ | ------------- |
| module | Module | NodeJS module |

**Return type**

Module

```typescript
executableModule<Module extends NodeModule>(module: Module, functor: () => never | void | Promise<any>): Module;
```

**Type parameters**

| Name   | Constraint |
| ------ | ---------- |
| Module | NodeModule |

**Parameters**

| Name    | Type                                   | Description                                                    |
| ------- | -------------------------------------- | -------------------------------------------------------------- |
| module  | Module                                 | NodeJS module                                                  |
| functor | () => never &#124; void &#124; Promise | The function to execute. If undefined, module.exports is used. |

**Return type**

Module

**Properties**

| Name       | Type                                       | Optional | Description                                                                       |
| ---------- | ------------------------------------------ | -------- | --------------------------------------------------------------------------------- |
| isLambda   | boolean                                    | false    | True if the application is running as a lambda function                           |
| isLocal    | boolean                                    | false    | True if running in a local environment.                                           |
| isTesting  | boolean                                    | false    | True if a unit test framework (jest, mocha) was detected.                         |
| isGitRepo  | boolean                                    | false    | True if the root application folder is a git repository (has .git and .gitignore) |
| manifest   | [IPackageManifest][interfacedeclaration-1] | false    | The root package.json manifest.                                                   |
| env        | ProcessEnv                                 | false    | The initial process.env                                                           |
| initialCwd | string                                     | false    | The initial directory when the application was started.                           |
| path       | string                                     | false    | Gets or sets the application root path                                            |

---

### IPackageManifest

The definition of a NodeJS package.json manifest

```typescript
interface IPackageManifest {
    name: string;
    version?: string | undefined;
    description?: string | undefined;
    keywords?: string[];
    homepage?: string | undefined;
    bugs?: string | { email: string; url: string; [key: string]: string | undefined; };
    license?: string | undefined;
    author?: string | { name: string; email?: string | undefined; homepage?: string | undefined; [key: string]: string | undefined; };
    contributors?: string[] | { name: string; email?: string | undefined; homepage?: string | undefined; [key: string]: string | undefined; }[];
    files?: string[];
    main?: string | undefined;
    bin?: string | { [name: string]: string | undefined; };
    man?: string | string[];
    directories?: { [key: string]: string | undefined; lib?: string | undefined; bin?: string | undefined; man?: st...;
    repository?: string | { type: string; url: string; };
    scripts?: { [scriptName: string]: string | undefined; } | undefined;
    config?: { [key: string]: any; } | undefined;
    dependencies?: { [name: string]: string | undefined; } | undefined;
    devDependencies?: { [name: string]: string | undefined; } | undefined;
    peerDependencies?: { [name: string]: string | undefined; } | undefined;
    optionalDependencies?: { [name: string]: string | undefined; } | undefined;
    bundledDependencies?: string[];
    engines?: { [key: string]: string | undefined; node?: string | undefined; npm?: string | undefined; } | und...;
    os?: string[];
    cpu?: string[];
    preferGlobal?: boolean | undefined;
    private?: boolean | undefined;
    publishConfig?: { [key: string]: string | undefined; registry?: string | undefined; } | undefined;
    [key: string]: any;
}
```

#### Index

```typescript
[key: string]: any;
```

- _Parameter_ `key` - string
- _Type_ any

**Properties**

| Name                 | Type                                                                                                                                             | Optional | Description             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------------------- |
| name                 | string                                                                                                                                           | false    | Package name. Required. |
| version              | string &#124; undefined                                                                                                                          | true     |                         |
| description          | string &#124; undefined                                                                                                                          | true     |                         |
| keywords             | string[]                                                                                                                                         | true     |                         |
| homepage             | string &#124; undefined                                                                                                                          | true     |                         |
| bugs                 | string &#124; { email: string; url: string; [key: string]: string &#124; undefined; }                                                            | true     |                         |
| license              | string &#124; undefined                                                                                                                          | true     |                         |
| author               | string &#124; { name: string; email?: string &#124; undefined; homepage?: string &#124; undefined; [key: string]: string &#124; undefined; }     | true     |                         |
| contributors         | string[] &#124; { name: string; email?: string &#124; undefined; homepage?: string &#124; undefined; [key: string]: string &#124; undefined; }[] | true     |                         |
| files                | string[]                                                                                                                                         | true     |                         |
| main                 | string &#124; undefined                                                                                                                          | true     |                         |
| bin                  | string &#124; { [name: string]: string &#124; undefined; }                                                                                       | true     |                         |
| man                  | string &#124; string[]                                                                                                                           | true     |                         |
| directories          | { [key: string]: string &#124; undefined; lib?: string &#124; undefined; bin?: string &#124; undefined; man?: st...                              | true     |                         |
| repository           | string &#124; { type: string; url: string; }                                                                                                     | true     |                         |
| scripts              | { [scriptName: string]: string &#124; undefined; } &#124; undefined                                                                              | true     |                         |
| config               | { [key: string]: any; } &#124; undefined                                                                                                         | true     |                         |
| dependencies         | { [name: string]: string &#124; undefined; } &#124; undefined                                                                                    | true     |                         |
| devDependencies      | { [name: string]: string &#124; undefined; } &#124; undefined                                                                                    | true     |                         |
| peerDependencies     | { [name: string]: string &#124; undefined; } &#124; undefined                                                                                    | true     |                         |
| optionalDependencies | { [name: string]: string &#124; undefined; } &#124; undefined                                                                                    | true     |                         |
| bundledDependencies  | string[]                                                                                                                                         | true     |                         |
| engines              | { [key: string]: string &#124; undefined; node?: string &#124; undefined; npm?: string &#124; undefined; } &#124; und...                         | true     |                         |
| os                   | string[]                                                                                                                                         | true     |                         |
| cpu                  | string[]                                                                                                                                         | true     |                         |
| preferGlobal         | boolean &#124; undefined                                                                                                                         | true     |                         |
| private              | boolean &#124; undefined                                                                                                                         | true     |                         |
| publishConfig        | { [key: string]: string &#124; undefined; registry?: string &#124; undefined; } &#124; undefined                                                 | true     |                         |

[sourcefile-0]: getAppRootPath.md#getapprootpathts
[interfacedeclaration-0]: getAppRootPath.md#approotpath
[interfacedeclaration-1]: getAppRootPath.md#ipackagemanifest
[interfacedeclaration-1]: getAppRootPath.md#ipackagemanifest
