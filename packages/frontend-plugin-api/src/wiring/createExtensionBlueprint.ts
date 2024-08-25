/*
 * Copyright 2024 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ApiHolder, AppNode } from '../apis';
import { Expand } from '../types';
import {
  ExtensionDefinition,
  ResolvedExtensionInputs,
  VerifyExtensionFactoryOutput,
  createExtension,
} from './createExtension';
import { z } from 'zod';
import { ExtensionInput } from './createExtensionInput';
import {
  AnyExtensionDataRef,
  ExtensionDataValue,
} from './createExtensionDataRef';
import {
  ExtensionDataContainer,
  createExtensionDataContainer,
} from './createExtensionDataContainer';
import {
  ResolveInputValueOverrides,
  resolveInputOverrides,
} from './resolveInputOverrides';

/**
 * @public
 */
export type CreateExtensionBlueprintOptions<
  TKind extends string,
  TNamespace extends string | undefined,
  TName extends string | undefined,
  TParams,
  UOutput extends AnyExtensionDataRef,
  TInputs extends {
    [inputName in string]: ExtensionInput<
      AnyExtensionDataRef,
      { optional: boolean; singleton: boolean }
    >;
  },
  TConfigSchema extends { [key in string]: (zImpl: typeof z) => z.ZodType },
  UFactoryOutput extends ExtensionDataValue<any, any>,
  TDataRefs extends { [name in string]: AnyExtensionDataRef },
> = {
  kind: TKind;
  namespace?: TNamespace;
  attachTo: { id: string; input: string };
  disabled?: boolean;
  inputs?: TInputs;
  output: Array<UOutput>;
  name?: TName;
  config?: {
    schema: TConfigSchema;
  };
  factory(
    params: TParams,
    context: {
      node: AppNode;
      apis: ApiHolder;
      config: {
        [key in keyof TConfigSchema]: z.infer<ReturnType<TConfigSchema[key]>>;
      };
      inputs: Expand<ResolvedExtensionInputs<TInputs>>;
    },
  ): Iterable<UFactoryOutput>;

  dataRefs?: TDataRefs;
} & VerifyExtensionFactoryOutput<UOutput, UFactoryOutput>;

/**
 * @public
 */
export interface ExtensionBlueprint<
  TIdParts extends {
    kind: string;
    namespace?: string;
    name?: string;
  },
  TParams,
  UOutput extends AnyExtensionDataRef,
  TInputs extends {
    [inputName in string]: ExtensionInput<
      AnyExtensionDataRef,
      { optional: boolean; singleton: boolean }
    >;
  },
  TConfig extends { [key in string]: unknown },
  TConfigInput extends { [key in string]: unknown },
  TDataRefs extends { [name in string]: AnyExtensionDataRef },
> {
  dataRefs: TDataRefs;

  make<
    TNewNamespace extends string | undefined,
    TNewName extends string | undefined,
  >(args: {
    namespace?: TNewNamespace;
    name?: TNewName;
    attachTo?: { id: string; input: string };
    disabled?: boolean;
    params: TParams;
  }): ExtensionDefinition<
    TConfig,
    TConfigInput,
    UOutput,
    TInputs,
    {
      kind: TIdParts['kind'];
      namespace: string | undefined extends TNewNamespace
        ? TIdParts['namespace']
        : TNewNamespace;
      name: string | undefined extends TNewName ? TIdParts['name'] : TNewName;
    }
  >;

  /**
   * Creates a new extension from the blueprint.
   *
   * You must either pass `params` directly, or define a `factory` that can
   * optionally call the original factory with the same params.
   */
  makeWithOverrides<
    TNewNamespace extends string | undefined,
    TNewName extends string | undefined,
    TExtensionConfigSchema extends {
      [key in string]: (zImpl: typeof z) => z.ZodType;
    },
    UFactoryOutput extends ExtensionDataValue<any, any>,
    UNewOutput extends AnyExtensionDataRef,
    TExtraInputs extends {
      [inputName in string]: ExtensionInput<
        AnyExtensionDataRef,
        { optional: boolean; singleton: boolean }
      >;
    },
  >(args: {
    namespace?: TNewNamespace;
    name?: TNewName;
    attachTo?: { id: string; input: string };
    disabled?: boolean;
    inputs?: TExtraInputs & {
      [KName in keyof TInputs]?: `Error: Input '${KName &
        string}' is already defined in parent definition`;
    };
    output?: Array<UNewOutput>;
    config?: {
      schema: TExtensionConfigSchema & {
        [KName in keyof TConfig]?: `Error: Config key '${KName &
          string}' is already defined in parent schema`;
      };
    };
    factory(
      originalFactory: (
        params: TParams,
        context?: {
          config?: TConfig;
          inputs?: ResolveInputValueOverrides<TInputs>;
        },
      ) => ExtensionDataContainer<UOutput>,
      context: {
        node: AppNode;
        apis: ApiHolder;
        config: TConfig & {
          [key in keyof TExtensionConfigSchema]: z.infer<
            ReturnType<TExtensionConfigSchema[key]>
          >;
        };
        inputs: Expand<ResolvedExtensionInputs<TInputs & TExtraInputs>>;
      },
    ): Iterable<UFactoryOutput> &
      VerifyExtensionFactoryOutput<
        AnyExtensionDataRef extends UNewOutput ? UOutput : UNewOutput,
        UFactoryOutput
      >;
  }): ExtensionDefinition<
    {
      [key in keyof TExtensionConfigSchema]: z.infer<
        ReturnType<TExtensionConfigSchema[key]>
      >;
    } & TConfig,
    z.input<
      z.ZodObject<{
        [key in keyof TExtensionConfigSchema]: ReturnType<
          TExtensionConfigSchema[key]
        >;
      }>
    > &
      TConfigInput,
    AnyExtensionDataRef extends UNewOutput ? UOutput : UNewOutput,
    TInputs & TExtraInputs,
    {
      kind: TIdParts['kind'];
      namespace: string | undefined extends TNewNamespace
        ? TIdParts['namespace']
        : TNewNamespace;
      name: string | undefined extends TNewName ? TIdParts['name'] : TNewName;
    }
  >;
}

/**
 * A simpler replacement for wrapping up `createExtension` inside a kind or type. This allows for a cleaner API for creating
 * types and instances of those types.
 *
 * @public
 */
export function createExtensionBlueprint<
  TParams,
  UOutput extends AnyExtensionDataRef,
  TInputs extends {
    [inputName in string]: ExtensionInput<
      AnyExtensionDataRef,
      { optional: boolean; singleton: boolean }
    >;
  },
  TConfigSchema extends { [key in string]: (zImpl: typeof z) => z.ZodType },
  UFactoryOutput extends ExtensionDataValue<any, any>,
  TKind extends string,
  TNamespace extends string | undefined = undefined,
  TName extends string | undefined = undefined,
  TDataRefs extends { [name in string]: AnyExtensionDataRef } = never,
>(
  options: CreateExtensionBlueprintOptions<
    TKind,
    TNamespace,
    TName,
    TParams,
    UOutput,
    TInputs,
    TConfigSchema,
    UFactoryOutput,
    TDataRefs
  >,
): ExtensionBlueprint<
  {
    kind: TKind;
    namespace: TNamespace;
    name: TName;
  },
  TParams,
  UOutput,
  string extends keyof TInputs ? {} : TInputs,
  string extends keyof TConfigSchema
    ? {}
    : { [key in keyof TConfigSchema]: z.infer<ReturnType<TConfigSchema[key]>> },
  string extends keyof TConfigSchema
    ? {}
    : z.input<
        z.ZodObject<{
          [key in keyof TConfigSchema]: ReturnType<TConfigSchema[key]>;
        }>
      >,
  TDataRefs
> {
  return {
    dataRefs: options.dataRefs,
    make(args) {
      return createExtension({
        kind: options.kind,
        namespace: args.namespace ?? options.namespace,
        name: args.name ?? options.name,
        attachTo: args.attachTo ?? options.attachTo,
        disabled: args.disabled ?? options.disabled,
        inputs: options.inputs,
        output: options.output as AnyExtensionDataRef[],
        config: options.config,
        factory: ctx =>
          options.factory(args.params, ctx) as Iterable<
            ExtensionDataValue<any, any>
          >,
      });
    },
    makeWithOverrides(args) {
      return createExtension({
        kind: options.kind,
        namespace: args.namespace ?? options.namespace,
        name: args.name ?? options.name,
        attachTo: args.attachTo ?? options.attachTo,
        disabled: args.disabled ?? options.disabled,
        inputs: { ...args.inputs, ...options.inputs },
        output: (args.output ?? options.output) as AnyExtensionDataRef[],
        config:
          options.config || args.config
            ? {
                schema: {
                  ...options.config?.schema,
                  ...args.config?.schema,
                },
              }
            : undefined,
        factory: ({ node, config, inputs, apis }) => {
          return args.factory(
            (innerParams, innerContext) => {
              return createExtensionDataContainer<UOutput>(
                options.factory(innerParams, {
                  apis,
                  node,
                  config: (innerContext?.config ?? config) as any,
                  inputs: resolveInputOverrides(
                    options.inputs,
                    inputs,
                    innerContext?.inputs,
                  ) as any,
                }) as Iterable<any>,
                options.output,
              );
            },
            {
              apis,
              node,
              config: config as any,
              inputs: inputs as any,
            },
          ) as Iterable<ExtensionDataValue<any, any>>;
        },
      }) as ExtensionDefinition<any>;
    },
  } as ExtensionBlueprint<
    {
      kind: TKind;
      namespace: TNamespace;
      name: TName;
    },
    TParams,
    UOutput,
    string extends keyof TInputs ? {} : TInputs,
    string extends keyof TConfigSchema
      ? {}
      : {
          [key in keyof TConfigSchema]: z.infer<ReturnType<TConfigSchema[key]>>;
        },
    string extends keyof TConfigSchema
      ? {}
      : z.input<
          z.ZodObject<{
            [key in keyof TConfigSchema]: ReturnType<TConfigSchema[key]>;
          }>
        >,
    TDataRefs
  >;
}
