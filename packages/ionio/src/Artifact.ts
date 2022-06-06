import fs from 'fs';
import { Argument, encodeArgument, PrimitiveType } from './Argument';
import { Requirement } from './Requirement';

interface Artifact {
  contractName: string;
  constructorInputs: Parameter[];
  functions: ArtifactFunction[];
}

interface Parameter {
  name: string;
  type: PrimitiveType;
}

interface ArtifactFunction {
  name: string;
  functionInputs: Parameter[];
  require: Requirement[];
  asm: string[];
}

function replaceASMtoken(
  toreplace: string,
  by: string
): (f: ArtifactFunction) => ArtifactFunction {
  return (f: ArtifactFunction): ArtifactFunction => ({
    ...f,
    asm: f.asm.map(token => {
      if (token === toreplace) {
        return by;
      }
      return token;
    }),
  });
}

function renameConstructorInput(
  artifact: Artifact,
  name: string,
  newName: string
): Artifact {
  const constructorInputToRename = artifact.constructorInputs.find(
    i => i.name === name
  );
  if (!constructorInputToRename) {
    throw new Error(`Constructor input "${name}" not found`);
  }
  return {
    ...artifact,
    constructorInputs: artifact.constructorInputs.map(p =>
      p.name === constructorInputToRename.name ? { ...p, name: newName } : p
    ),
    functions: artifact.functions.map(
      replaceASMtoken('$' + constructorInputToRename.name, '$' + newName)
    ),
  };
}

function encodeConstructorArg(
  artifact: Artifact,
  inputName: string,
  arg: Argument
): Artifact {
  // compile the constructor input
  const constructorInputToCompile = artifact.constructorInputs.find(
    i => i.name === inputName
  );
  if (!constructorInputToCompile) {
    throw new Error(`Constructor input ${inputName} not found`);
  }
  const argEncoded = encodeArgument(arg, constructorInputToCompile.type);

  return {
    ...artifact,
    // remove compiled constructor input
    constructorInputs: artifact.constructorInputs.filter(
      p => p.name !== constructorInputToCompile.name
    ),
    functions: artifact.functions.map(
      replaceASMtoken(
        '$' + constructorInputToCompile.name,
        argEncoded.toString('hex')
      )
    ),
  };
}

interface TemplateStringI {
  newName: string;
}

function isTemplateStringI(arg: any): arg is TemplateStringI {
  return Object.keys(arg).includes('newName');
}

function TemplateString(newName: string): TemplateStringI {
  return { newName };
}

function transformArtifact(
  artifact: Artifact,
  args: (Argument | TemplateStringI)[]
): Artifact {
  let newArtifact = { ...artifact };
  artifact.constructorInputs.forEach((input, i) => {
    const arg = args[i];
    if (arg) {
      if (isTemplateStringI(arg)) {
        newArtifact = renameConstructorInput(
          newArtifact,
          input.name,
          arg.newName
        );
      } else {
        newArtifact = encodeConstructorArg(newArtifact, input.name, arg);
      }
    }
  });
  return newArtifact;
}

function importArtifact(artifactFile: string): Artifact {
  return JSON.parse(fs.readFileSync(artifactFile, { encoding: 'utf-8' }));
}

function exportArtifact(artifact: Artifact, targetFile: string): void {
  const jsonString = JSON.stringify(artifact, null, 2);
  fs.writeFileSync(targetFile, jsonString);
}

export {
  Artifact,
  ArtifactFunction,
  Requirement,
  Parameter,
  exportArtifact,
  importArtifact,
  transformArtifact,
  TemplateString,
};
