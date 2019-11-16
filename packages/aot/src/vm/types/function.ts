/* eslint-disable */
import { $Object } from './object';
import { $EnvRec, $FunctionEnvRec } from './environment-record';
import { $FunctionDeclaration, $MethodDeclaration, $ArrowFunction, $SourceFile } from '../ast';
import { $Boolean } from './boolean';
import { $String } from './string';
import { $Any, $AnyNonEmpty } from './_shared';
import { $PropertyDescriptor } from './property-descriptor';
import { $Number } from './number';
import { $DefinePropertyOrThrow, $Get } from '../operations';
import { $Symbol } from './symbol';
import { Intrinsics } from '../intrinsics';
import { $Undefined } from './undefined';
import { ExecutionContext, Realm } from '../realm';

// http://www.ecma-international.org/ecma-262/#table-6
// http://www.ecma-international.org/ecma-262/#sec-ecmascript-function-objects
export class $Function<
  T extends string = string,
> extends $Object<T> {
  public readonly '<$Function>': unknown;

  public get isFunction(): true { return true; }

  public ['[[Environment]]']: $EnvRec;
  public ['[[FunctionKind]]']: FunctionKind;
  public ['[[ECMAScriptCode]]']: $FunctionDeclaration | $MethodDeclaration | $ArrowFunction;
  public ['[[ConstructorKind]]']: ConstructorKind;
  public ['[[Realm]]']: Realm;
  public ['[[ScriptOrModule]]']: $SourceFile;
  public ['[[ThisMode]]']: ThisMode;
  public ['[[Strict]]']: $Boolean;
  public ['[[HomeObject]]']: $Object;
  public ['[[SourceText]]']: $String;

  public constructor(
    realm: Realm,
    IntrinsicName: T,
    proto: $Object,
  ) {
    super(realm, IntrinsicName, proto);
  }

  // http://www.ecma-international.org/ecma-262/#sec-ecmascript-function-objects-call-thisargument-argumentslist
  public '[[Call]]'(thisArgument: $AnyNonEmpty, argumentsList: readonly $Any[]): $AnyNonEmpty {
    // 1. Assert: F is an ECMAScript function object.
    const F = this;
    const realm = F['[[Realm]]'];
    const intrinsics = realm['[[Intrinsics]]'];

    // 2. If F.[[FunctionKind]] is "classConstructor", throw a TypeError exception.
    if (F['[[FunctionKind]]'] === 'classConstructor') {
      throw new TypeError('2. If F.[[FunctionKind]] is "classConstructor", throw a TypeError exception.');
    }

    // 3. Let callerContext be the running execution context.
    const stack = realm.stack;
    const callerContext = stack.top;

    // 4. Let calleeContext be PrepareForOrdinaryCall(F, undefined).
    const calleeContext = $PrepareForOrdinaryCall(F, intrinsics.undefined);

    // 5. Assert: calleeContext is now the running execution context.
    // 6. Perform OrdinaryCallBindThis(F, calleeContext, thisArgument).
    $OrdinaryCallBindThis(F, calleeContext, thisArgument);

    // 7. Let result be OrdinaryCallEvaluateBody(F, argumentsList).
    const result = $OrdinaryCallEvaluateBody(F, argumentsList);

    // 8. Remove calleeContext from the execution context stack and restore callerContext as the running execution context.
    stack.pop(); // TODO: verify

    // 9. If result.[[Type]] is return, return NormalCompletion(result.[[Value]]).
    // 10. ReturnIfAbrupt(result).
    // 11. Return NormalCompletion(undefined).
    return result;
  }

  // http://www.ecma-international.org/ecma-262/#sec-ecmascript-function-objects-construct-argumentslist-newtarget
  public '[[Construct]]'(argumentsList: readonly $Any[], newTarget: $Object): $Object {
    // 1. Assert: F is an ECMAScript function object.
    const F = this;
    const realm = F['[[Realm]]'];
    const intrinsics = realm['[[Intrinsics]]'];
    const stack = realm.stack;

    // 2. Assert: Type(newTarget) is Object.
    // 3. Let callerContext be the running execution context.
    const callerContext = stack.top;

    // 4. Let kind be F.[[ConstructorKind]].
    const kind = F['[[ConstructorKind]]'];

    let thisArgument: $AnyNonEmpty;
    // 5. If kind is "base", then
    if (kind === 'base') {
      // 5. a. Let thisArgument be ? OrdinaryCreateFromConstructor(newTarget, "%ObjectPrototype%").
      thisArgument = $OrdinaryCreateFromConstructor(newTarget, '%ObjectPrototype%');
    } else {
      thisArgument = intrinsics.undefined;
    }

    // 6. Let calleeContext be PrepareForOrdinaryCall(F, newTarget).
    const calleeContext = $PrepareForOrdinaryCall(F, newTarget);

    // 7. Assert: calleeContext is now the running execution context.
    // 8. If kind is "base", perform OrdinaryCallBindThis(F, calleeContext, thisArgument).
    if (kind === 'base') {
      $OrdinaryCallBindThis(F, calleeContext, thisArgument);
    }

    // 9. Let constructorEnv be the LexicalEnvironment of calleeContext.
    // 10. Let envRec be constructorEnv's EnvironmentRecord.
    const envRec = calleeContext.LexicalEnvironment;

    // 11. Let result be OrdinaryCallEvaluateBody(F, argumentsList).
    const result = $OrdinaryCallEvaluateBody(F, argumentsList);

    // 12. Remove calleeContext from the execution context stack and restore callerContext as the running execution context.
    stack.pop();

    // 13. If result.[[Type]] is return, then
    // 13. a. If Type(result.[[Value]]) is Object, return NormalCompletion(result.[[Value]]).
    // 13. b. If kind is "base", return NormalCompletion(thisArgument).
    // 13. c. If result.[[Value]] is not undefined, throw a TypeError exception.
    // 14. Else, ReturnIfAbrupt(result).
    // 15. Return ? envRec.GetThisBinding().

    // TODO: integrate with CompletionRecord
    return result as $Object;
  }

  // http://www.ecma-international.org/ecma-262/#sec-functionallocate
  public static FunctionAllocate(
    functionPrototype: $Object,
    strict: $Boolean,
    functionKind: 'normal' | 'non-constructor' | 'generator' | 'async' | 'async generator',
  ): $Function {
    // 1. Assert: Type(functionPrototype) is Object.
    // 2. Assert: functionKind is either "normal", "non-constructor", "generator", "async", or "async generator".
    // 3. If functionKind is "normal", let needsConstruct be true.
    // 4. Else, let needsConstruct be false.
    const needsConstruct = functionKind === 'normal';

    // 5. If functionKind is "non-constructor", set functionKind to "normal".
    if (functionKind === 'non-constructor') {
      functionKind = 'normal';
    }

    const realm = functionPrototype.realm;
    const intrinsics = realm['[[Intrinsics]]'];

    // 6. Let F be a newly created ECMAScript function object with the internal slots listed in Table 27. All of those internal slots are initialized to undefined.
    const F = new $Function(realm, 'function', functionPrototype);

    // 7. Set F's essential internal methods to the default ordinary object definitions specified in 9.1.
    // 8. Set F.[[Call]] to the definition specified in 9.2.1.
    // 9. If needsConstruct is true, then
    if (needsConstruct) {
      // 9. a. Set F.[[Construct]] to the definition specified in 9.2.2.
      // 9. b. Set F.[[ConstructorKind]] to "base".
      F['[[ConstructorKind]]'] = 'base';
    }

    // 10. Set F.[[Strict]] to strict.
    F['[[Strict]]'] = strict;

    // 11. Set F.[[FunctionKind]] to functionKind.
    F['[[FunctionKind]]'] = functionKind;

    // 12. Set F.[[Prototype]] to functionPrototype.
    F['[[Prototype]]'] = functionPrototype;

    // 13. Set F.[[Extensible]] to true.
    F['[[Extensible]]'] = intrinsics.true;

    // 14. Set F.[[Realm]] to the current Realm Record.
    F['[[Realm]]'] = realm;

    // 15. Return F.
    return F;
  }

  // http://www.ecma-international.org/ecma-262/#sec-functioninitialize
  public static FunctionInitialize(
    F: $Function,
    kind: 'normal' | 'method' | 'arrow',
    node: $FunctionDeclaration | $MethodDeclaration | $ArrowFunction,
    Scope: $EnvRec,
  ): $Function {
    const realm = F['[[Realm]]'];
    const intrinsics = realm['[[Intrinsics]]'];

    // 1. Let len be the ExpectedArgumentCount of ParameterList.
    const len = node.ExpectedArgumentCount;

    // 2. Perform ! SetFunctionLength(F, len).
    const Desc = new $PropertyDescriptor(realm, intrinsics.length);
    Desc['[[Value]]'] = new $Number(realm, len);
    Desc['[[Writable]]'] = intrinsics.false;
    Desc['[[Enumerable]]'] = intrinsics.false;
    Desc['[[Configurable]]'] = intrinsics.true;
    $DefinePropertyOrThrow(F, intrinsics.length, Desc);

    // 3. Let Strict be F.[[Strict]].
    const Strict = F['[[Strict]]'];

    // 4. Set F.[[Environment]] to Scope.
    F['[[Environment]]'] = Scope;

    // 5. Set F.[[FormalParameters]] to ParameterList.
    // 6. Set F.[[ECMAScriptCode]] to Body.
    F['[[ECMAScriptCode]]'] = node;

    // 7. Set F.[[ScriptOrModule]] to GetActiveScriptOrModule().
    F['[[ScriptOrModule]]'] = realm.GetActiveScriptOrModule();

    // 8. If kind is Arrow, set F.[[ThisMode]] to lexical.
    if (kind === 'arrow') {
      F['[[ThisMode]]'] = 'lexical';
    }
    // 9. Else if Strict is true, set F.[[ThisMode]] to strict.
    else if (Strict.isTruthy) {
      F['[[ThisMode]]'] = 'strict';
    }
    // 10. Else, set F.[[ThisMode]] to global.
    else {
      F['[[ThisMode]]'] = 'global';
    }

    // 11. Return F.
    return F;
  }


  // http://www.ecma-international.org/ecma-262/#sec-functioncreate
  public static FunctionCreate(
    kind: 'normal' | 'method' | 'arrow',
    node: $FunctionDeclaration | $MethodDeclaration | $ArrowFunction,
    Scope: $EnvRec,
    Strict: $Boolean,
    prototype?: $Object,
  ) {
    const realm = node.realm;
    const intrinsics = realm['[[Intrinsics]]'];

    // 1. If prototype is not present, then
    if (prototype === void 0) {
      // 1. a. Set prototype to the intrinsic object %FunctionPrototype%.
      prototype = intrinsics['%FunctionPrototype%'];
    }

    let allocKind: 'normal' | 'non-constructor';
    // 2. If kind is not Normal, let allocKind be "non-constructor".
    if (kind !== 'normal') {
      allocKind = 'non-constructor';
    }
    // 3. Else, let allocKind be "normal".
    else {
      allocKind = 'normal';
    }

    // 4. Let F be FunctionAllocate(prototype, Strict, allocKind).
    const F = this.FunctionAllocate(prototype!, Strict, allocKind);

    // 5. Return FunctionInitialize(F, kind, ParameterList, Body, Scope).
    return this.FunctionInitialize(F, kind, node, Scope);
  }

  // http://www.ecma-international.org/ecma-262/#sec-makeconstructor
  public MakeConstructor(writablePrototype?: $Boolean, prototype?: $Object): void {
    const realm = this.realm;
    const intrinsics = realm['[[Intrinsics]]'];
    const F = this;

    // 1. Assert: F is an ECMAScript function object.
    // 2. Assert: IsConstructor(F) is true.
    // 3. Assert: F is an extensible object that does not have a prototype own property.
    // 4. If writablePrototype is not present, set writablePrototype to true.
    if (writablePrototype === void 0) {
      writablePrototype = intrinsics.true;
    }

    // 5. If prototype is not present, then
    if (prototype === void 0) {
      // 5. a. Set prototype to ObjectCreate(%ObjectPrototype%).
      prototype = $Object.ObjectCreate('constructor', intrinsics['%ObjectPrototype%']);

      // 5. b. Perform ! DefinePropertyOrThrow(prototype, "constructor", PropertyDescriptor { [[Value]]: F, [[Writable]]: writablePrototype, [[Enumerable]]: false, [[Configurable]]: true }).
      const Desc = new $PropertyDescriptor(realm, intrinsics.$constructor);
      Desc['[[Value]]'] = F;
      Desc['[[Writable]]'] = writablePrototype;
      Desc['[[Enumerable]]'] = intrinsics.false;
      Desc['[[Configurable]]'] = intrinsics.true;

      $DefinePropertyOrThrow(prototype, intrinsics.$constructor, Desc);
    }

    // 6. Perform ! DefinePropertyOrThrow(F, "prototype", PropertyDescriptor { [[Value]]: prototype, [[Writable]]: writablePrototype, [[Enumerable]]: false, [[Configurable]]: false }).
    const Desc = new $PropertyDescriptor(realm, intrinsics.$prototype);
    Desc['[[Value]]'] = prototype;
    Desc['[[Writable]]'] = writablePrototype;
    Desc['[[Enumerable]]'] = intrinsics.false;
    Desc['[[Configurable]]'] = intrinsics.false;

    $DefinePropertyOrThrow(F, intrinsics.$prototype, Desc);

    // 7. Return NormalCompletion(undefined).
  }

  // http://www.ecma-international.org/ecma-262/#sec-setfunctionname
  public SetFunctionName(name: $String | $Symbol, prefix?: $String): $Boolean {
    const realm = this.realm;
    const intrinsics = realm['[[Intrinsics]]'];

    // 1. Assert: F is an extensible object that does not have a name own property.
    // 2. Assert: Type(name) is either Symbol or String.
    // 3. Assert: If prefix is present, then Type(prefix) is String.
    // 4. If Type(name) is Symbol, then
    if (name.isSymbol) {
      // 4. a. Let description be name's [[Description]] value.
      const description = name.Description;

      // 4. b. If description is undefined, set name to the empty String.
      if (description.isUndefined) {
        name = intrinsics[''];
      }
      // 4. c. Else, set name to the string-concatenation of "[", description, and "]".
      else {
        name = new $String(realm, `[${description['[[Value]]']}]`);
      }
    }

    // 5. If prefix is present, then
    if (prefix !== void 0) {
      // 5. a. Set name to the string-concatenation of prefix, the code unit 0x0020 (SPACE), and name.
      name = new $String(realm, `${prefix['[[Value]]']} ${name['[[Value]]']}`);
    }

    // 6. Return ! DefinePropertyOrThrow(F, "name", PropertyDescriptor { [[Value]]: name, [[Writable]]: false, [[Enumerable]]: false, [[Configurable]]: true }).
    const Desc = new $PropertyDescriptor(realm, intrinsics.$prototype);
    Desc['[[Value]]'] = name;
    Desc['[[Writable]]'] = intrinsics.false;
    Desc['[[Enumerable]]'] = intrinsics.false;
    Desc['[[Configurable]]'] = intrinsics.true;

    return $DefinePropertyOrThrow(this, intrinsics.$name, Desc);
  }
}

// http://www.ecma-international.org/ecma-262/#sec-ordinarycreatefromconstructor
function $OrdinaryCreateFromConstructor<T extends keyof Intrinsics = keyof Intrinsics, TSlots extends {} = {}>(
  constructor: $Object,
  intrinsicDefaultProto: T,
  internalSlotsList?: TSlots,
): $Object<T> & TSlots {
  // 1. Assert: intrinsicDefaultProto is a String value that is this specification's name of an intrinsic object. The corresponding object must be an intrinsic that is intended to be used as the [[Prototype]] value of an object.
  // 2. Let proto be ? GetPrototypeFromConstructor(constructor, intrinsicDefaultProto).
  const proto = $GetPrototypeFromConstructor(constructor, intrinsicDefaultProto);

  // 3. Return ObjectCreate(proto, internalSlotsList).
  return $Object.ObjectCreate(intrinsicDefaultProto, proto, internalSlotsList);
}


// http://www.ecma-international.org/ecma-262/#sec-getprototypefromconstructor
function $GetPrototypeFromConstructor<T extends keyof Intrinsics = keyof Intrinsics>(
  constructor: $Object,
  intrinsicDefaultProto: T,
): $Object {
  const realm = constructor.realm;
  const intrinsics = realm['[[Intrinsics]]'];

  // 1. Assert: intrinsicDefaultProto is a String value that is this specification's name of an intrinsic object. The corresponding object must be an intrinsic that is intended to be used as the [[Prototype]] value of an object.
  // 2. Assert: IsCallable(constructor) is true.
  // 3. Let proto be ? Get(constructor, "prototype").
  let proto = $Get(constructor, intrinsics.$prototype);

  // 4. If Type(proto) is not Object, then
  if (!proto.isObject) {
    // 4. a. Let realm be ? GetFunctionRealm(constructor).
    // 4. b. Set proto to realm's intrinsic object named intrinsicDefaultProto.
    proto = intrinsics[intrinsicDefaultProto] as $AnyNonEmpty;
  }

  // 5. Return proto.
  return proto as $Object;
}

// http://www.ecma-international.org/ecma-262/#sec-prepareforordinarycall
function $PrepareForOrdinaryCall(F: $Function, newTarget: $Object | $Undefined): ExecutionContext {
  const realm = F.realm;
  const stack = realm.stack;

  // 1. Assert: Type(newTarget) is Undefined or Object.
  // 2. Let callerContext be the running execution context.
  const callerContext = stack.top;

  // 3. Let calleeContext be a new ECMAScript code execution context.
  const calleeContext = new ExecutionContext();

  // 4. Set the Function of calleeContext to F.
  calleeContext.Function = F;

  // 5. Let calleeRealm be F.[[Realm]].
  const calleeRealm = realm;

  // 6. Set the Realm of calleeContext to calleeRealm.
  calleeContext.Realm = calleeRealm;

  // 7. Set the ScriptOrModule of calleeContext to F.[[ScriptOrModule]].
  callerContext.ScriptOrModule = F['[[ScriptOrModule]]'];

  // 8. Let localEnv be NewFunctionEnvironment(F, newTarget).
  const localEnv = new $FunctionEnvRec(realm, F, newTarget);

  // 9. Set the LexicalEnvironment of calleeContext to localEnv.
  calleeContext.LexicalEnvironment = localEnv;

  // 10. Set the VariableEnvironment of calleeContext to localEnv.
  callerContext.VariableEnvironment = localEnv;

  // 11. If callerContext is not already suspended, suspend callerContext.
  callerContext.suspend();

  // 12. Push calleeContext onto the execution context stack; calleeContext is now the running execution context.
  stack.push(calleeContext);

  // 13. NOTE: Any exception objects produced after this point are associated with calleeRealm.
  // 14. Return calleeContext.
  return calleeContext;
}


// http://www.ecma-international.org/ecma-262/#sec-ordinarycallbindthis
function $OrdinaryCallBindThis(
  F: $Function,
  calleeContext: ExecutionContext,
  thisArgument: $AnyNonEmpty,
): $AnyNonEmpty {
  const calleeRealm = F['[[Realm]]'];
  const intrinsics = calleeRealm['[[Intrinsics]]'];

  // 1. Let thisMode be F.[[ThisMode]].
  const thisMode = F['[[ThisMode]]'];

  // 2. If thisMode is lexical, return NormalCompletion(undefined).
  if (thisMode === 'lexical') {
    return intrinsics.undefined;
  }

  // 3. Let calleeRealm be F.[[Realm]].'];
  // 4. Let localEnv be the LexicalEnvironment of calleeContext.
  const localEnv = calleeContext.LexicalEnvironment;

  let thisValue: $AnyNonEmpty;
  // 5. If thisMode is strict, let thisValue be thisArgument.
  if (thisMode === 'strict') {
    thisValue = thisArgument;
  }
  // 6. Else,
  else {
    // 6. a. If thisArgument is undefined or null, then
    if (thisArgument.isNil) {
      // 6. a. i. Let globalEnv be calleeRealm.[[GlobalEnv]].
      // 6. a. ii. Let globalEnvRec be globalEnv's EnvironmentRecord.
      const globalEnvRec = calleeRealm['[[GlobalEnv]]'];

      // 6. a. iii. Assert: globalEnvRec is a global Environment Record.
      // 6. a. iv. Let thisValue be globalEnvRec.[[GlobalThisValue]].
      thisValue = globalEnvRec['[[GlobalThisValue]]'];
    }
    // 6. b. Else,
    else {
      // 6. b. i. Let thisValue be ! ToObject(thisArgument).
      thisValue = thisArgument.ToObject();

      // 6. b. ii. NOTE: ToObject produces wrapper objects using calleeRealm.
    }
  }

  // 7. Let envRec be localEnv's EnvironmentRecord.
  const envRec = localEnv as $FunctionEnvRec;

  // 8. Assert: envRec is a function Environment Record.
  // 9. Assert: The next step never returns an abrupt completion because envRec.[[ThisBindingStatus]] is not "initialized".

  // 10. Return envRec.BindThisValue(thisValue).
  return envRec.BindThisValue(thisValue);
}

// http://www.ecma-international.org/ecma-262/#sec-ordinarycallevaluatebody
function $OrdinaryCallEvaluateBody(
  F: $Function,
  argumentsList: readonly $Any[],
): $AnyNonEmpty {
  // TODO: hook this up to EvaluateBody
  return null as any;
}

export type FunctionKind = 'normal' | 'classConstructor' | 'generator' | 'async' | 'async generator';
export type ConstructorKind = 'base' | 'derived';
export type ThisMode = 'lexical' | 'strict' | 'global';

// http://www.ecma-international.org/ecma-262/#sec-built-in-function-objects
export class $BuiltinFunction<
  T extends string = string,
> extends $Function<T> {
  public readonly '<$BuiltinFunction>': unknown;

  public constructor(
    realm: Realm,
    IntrinsicName: T,
    proto: $Object,
    private readonly $invoke: CallableFunction,
  ) {
    super(realm, IntrinsicName, proto);
  }
}
