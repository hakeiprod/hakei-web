import { JSONSchema, compile } from "json-schema-to-typescript";
import fs from "node:fs";
import * as R from "remeda";
import { isNonNullish, isNullish } from "remeda";
import { SetRequired } from "type-fest";
import * as xml2js from "xml2js";

const parser = new xml2js.Parser({
  explicitChildren: true,
});
const preserveChildrenOrder = true;

const musicxml = await parser.parseStringPromise(
  fs.readFileSync("src/s-core/const/musicxml/4.0/musicxml.xsd"),
);
export const xsdToJsonSchema = async () => {
  const xlink = await parser.parseStringPromise(
    fs.readFileSync("src/s-core/const/musicxml/4.0/xlink.xsd"),
  );
  const xml = await parser.parseStringPromise(
    fs.readFileSync("src/s-core/const/musicxml/4.0/xml.xsd"),
  );
  const ts = await compile(
    {
      type: "object",
      properties: {
        "score-partwise": {
          $ref: "#/$defs/musicxml/element/score-partwise",
        },
      },
      $defs: {
        xlink: {
          attribute: R.pipe(
            xlink["xs:schema"].$$["xs:attribute"] as Attribute[],
            R.map(handleAttribute),
            R.mapToObj(({ title, ...other }) => [title, other]),
          ),
        },
        xml: {
          attribute: R.pipe(
            xml["xs:schema"].$$["xs:attribute"],
            R.map(handleAttribute),
            R.mapToObj(({ title, ...other }) => [title, other]),
          ),
          attributeGroup: R.pipe(
            xml["xs:schema"].$$["xs:attributeGroup"],
            R.map(handleAttributeGroup),
            R.mapToObj(({ title, ...other }) => [title, other]),
          ),
        },
        musicxml: {
          type: R.mergeAll([
            R.pipe(
              musicxml["xs:schema"].$$["xs:simpleType"],
              R.map(
                (data) =>
                  handleSimpleType(data) as SetRequired<JSONSchema, "title">,
              ),
              R.mapToObj(({ title, ...other }) => [title, other]),
            ),
            R.pipe(
              musicxml["xs:schema"].$$["xs:complexType"],
              R.map(
                (data) =>
                  handleComplexType(data) as SetRequired<JSONSchema, "title">,
              ),
              R.mapToObj(({ title, ...other }) => [title, other]),
            ),
          ]),
          attributeGroup: R.pipe(
            musicxml["xs:schema"].$$["xs:attributeGroup"],
            R.map(handleAttributeGroup),
            R.mapToObj(({ title, ...other }) => [title, other]),
          ),
          group: R.pipe(
            musicxml["xs:schema"].$$["xs:group"],
            R.map((group) => handleGroup(group)),
            R.mapToObj(({ title, ...other }) => [title, other]),
          ),
          preserveChildrenOrderGroup: R.pipe(
            musicxml["xs:schema"].$$["xs:group"],
            R.map((group) => handleGroup(group, true)),
            R.mapToObj(({ title, ...other }) => [title, other]),
          ),
          element: R.pipe(
            musicxml["xs:schema"].$$["xs:element"],
            R.map((element) => handleElement(element)),
            R.mapToObj(({ title, ...other }) => [title, other]),
          ),
        },
      },
    },
    "MusicXML",
    { additionalProperties: false },
  );
  fs.writeFileSync("src/s-core/const/musicxml/4.0/musicxml.ts", ts);
};

type XsType =
  | "xs:language"
  | "xs:string"
  | "xs:token"
  | "xs:date"
  | "xs:ID"
  | "xs:IDREF"
  | "xs:NMTOKEN"
  | "xs:NCName"
  | "xs:anyURI"
  | "xs:integer"
  | "xs:decimal"
  | "xs:nonNegativeInteger"
  | "xs:positiveInteger";

type Enumeration = { $: { value: string } };
type Restriction = {
  $: { base: XsType };
  $$?: {
    ["xs:enumeration"]?: Enumeration[];
    ["xs:minInclusive"]?: [{ $: { value: string } }];
    ["xs:maxInclusive"]?: [{ $: { value: string } }];
  };
};
type Union = {
  $: { memberTypes: string };
  $$?: { ["xs:simpleType"]?: SimpleType[] };
};
type SimpleType = {
  $?: { name: string };
  $$: {
    ["xs:restriction"]?: Restriction[];
    ["xs:union"]?: Union[];
  };
};
type ComplexType = {
  $?: { name?: string };
  $$?: {
    ["xs:annotation"]: Annotation[];
    ["xs:simpleContent"]?: SimpleContent[];
    ["xs:complexContent"]?: ComplexContent[];
    ["xs:choice"]?: Choice[];
    ["xs:sequence"]?: Sequence[];
    ["xs:group"]?: Group[];
    ["xs:attributeGroup"]?: AttributeGroup[];
    ["xs:attribute"]?: Attribute[];
  };
};
type Attribute = {
  $: {
    name?: string;
    type?: XsType;
    ref?: string;
    use?: string;
    default?: string;
  };
  $$?: { ["xs:simpleType"]?: SimpleType[]; ["xs:annotation"]?: Annotation[] };
};
type AttributeGroup = {
  $: { name?: string; ref?: string };
  $$?: {
    ["xs:attribute"]?: Attribute[];
    ["xs:annotation"]: Annotation[];
    ["xs:attributeGroup"]?: { $: { ref: string } }[];
  };
};
type Annotation = { $$: { ["xs:documentation"]: string[] } };
type Group = {
  $: { name: string; ref?: string; minOccurs?: string; maxOccurs?: string };
  $$?: {
    ["xs:annotation"]: Annotation[];
    ["xs:sequence"]: Sequence[];
  };
};
type Sequence = {
  $$: {
    ["xs:element"]?: Element[];
    ["xs:group"]?: Group[];
    ["xs:choice"]?: Choice[];
    ["xs:sequence"]?: Sequence[];
  };
};
type Element = {
  $: { name: string; type?: string; minOccurs?: string; maxOccurs?: string };
  $$?: {
    ["xs:annotation"]?: Annotation[];
    ["xs:complexType"]?: ComplexType[];
  };
};
type Choice = {
  $?: { minOccurs: string; maxOccurs: string };
  $$: {
    ["xs:element"]?: Element[];
    ["xs:sequence"]?: Sequence[];
    ["xs:group"]?: Group[];
    ["xs:choice"]?: Choice[];
  };
};
type SimpleContent = { $$: { "xs:extension": Extension[] } };
type ComplexContent = { $$: { "xs:extension": Extension[] } };
type Extension = {
  $: { base: string };
  $$?: {
    ["xs:attribute"]?: Attribute[];
    ["xs:attributeGroup"]?: AttributeGroup[];
  };
};
function handleXsType(base: XsType): JSONSchema {
  switch (base) {
    case "xs:string":
    case "xs:token":
    case "xs:ID":
    case "xs:IDREF":
    case "xs:date":
    case "xs:anyURI":
    case "xs:NMTOKEN":
    case "xs:NCName":
    case "xs:language": {
      return template({ type: "string" });
    }
    case "xs:integer": {
      return template({ type: "integer" });
    }
    case "xs:nonNegativeInteger": {
      return template({ type: "integer", minimum: 0 });
    }
    case "xs:positiveInteger": {
      return template({ type: "integer", minimum: 1 });
    }
    case "xs:decimal": {
      return template({ type: "number" });
    }
  }
  function template(object: JSONSchema) {
    return object;
  }
}
function handleType(type: string) {
  return type.includes("xs:")
    ? handleXsType(type as XsType)
    : { $ref: "#/$defs/musicxml/type/" + type };
}
function handleAttributeGroup({
  $: { name, ref },
  $$,
}: AttributeGroup): SetRequired<JSONSchema, "title"> {
  const attributes = $$?.["xs:attribute"];
  const attributeGroups = $$?.["xs:attributeGroup"];
  const annotation = $$?.["xs:annotation"]?.[0];
  return {
    title: name ?? ref ?? "error",
    ...(ref && { $ref: "#/$defs/musicxml/attributeGroup/" + ref }),
    ...(annotation && handleAnnotation(annotation)),
    ...((attributes || attributeGroups) && {
      allOf: [
        ...(attributes
          ? [
              {
                properties: R.pipe(
                  attributes,
                  R.map(handleAttribute),
                  R.mapToObj(({ title, ...other }) => [title, other]),
                ),
              },
            ]
          : []),
        ...(attributeGroups?.map((attributeGroup) => ({
          $ref: "#/$defs/musicxml/attributeGroup/" + attributeGroup.$.ref,
        })) ?? []),
      ],
    }),
  };
}
function handleAttribute({
  $: { type, name, ref, default: $default },
  $$,
}: Attribute): SetRequired<JSONSchema, "title"> {
  const simpleType = $$?.["xs:simpleType"]?.[0];
  const annotation = $$?.["xs:annotation"]?.[0];
  return {
    title: name ?? ref ?? "error",
    ...($default && { default: $default }),
    ...(ref && handleReference(ref)),
    ...(type && handleType(type)),
    ...(simpleType && handleSimpleType(simpleType)),
    ...(annotation && handleAnnotation(annotation)),
  };
}
function handleAnnotation({ $$ }: Annotation): JSONSchema {
  return {
    description: $$["xs:documentation"][0],
  };
}
function handleSimpleType({ $, $$ }: SimpleType): JSONSchema {
  const restriction = $$["xs:restriction"]?.[0];
  const union = $$["xs:union"]?.[0];
  return {
    ...($?.name && { title: $.name }),
    ...(restriction && handleRestriction(restriction)),
    ...(union && handleUnion(union)),
  };
}
function handleUnion({ $, $$ }: Union): JSONSchema {
  const memberTypes = $.memberTypes;
  const simpleType = $$?.["xs:simpleType"]?.[0];
  return {
    anyOf: [
      ...memberTypes.split(" ").map(handleType),
      ...(simpleType ? [handleSimpleType(simpleType)] : []),
    ],
  };
}
function handleRestriction({ $, $$ }: Restriction): JSONSchema {
  const enumeration = $$?.["xs:enumeration"];
  const minInclusive = $$?.["xs:minInclusive"]?.[0];
  const maxInclusive = $$?.["xs:maxInclusive"]?.[0];
  return {
    ...handleXsType($.base),
    ...(enumeration && { enum: enumeration.map(({ $ }) => $.value) }),
    ...(minInclusive && { minimum: Number(minInclusive.$.value) }),
    ...(maxInclusive && { maximum: Number(maxInclusive.$.value) }),
  };
}
function handleGroup(
  { $: { name, ref }, $$ }: Group,
  preserveChildrenOrder: boolean = false,
): SetRequired<JSONSchema, "title"> {
  const annotation = $$?.["xs:annotation"][0];
  const sequence = $$?.["xs:sequence"][0];
  return {
    title: name,
    ...(ref && {
      $ref:
        `#/$defs/musicxml/${preserveChildrenOrder ? "preserveChildrenOrderGroup" : "group"}/` +
        ref,
    }),
    ...(sequence && handleSequence(sequence, preserveChildrenOrder)),
    ...(annotation && handleAnnotation(annotation)),
  };
}
function handleSequence(
  { $$ }: Sequence,
  preserveChildrenOrder: boolean = false,
): JSONSchema {
  const elements = $$["xs:element"];
  const choices = $$["xs:choice"];
  const groups = $$["xs:group"];
  const sequence = $$["xs:sequence"];
  if (preserveChildrenOrder) {
    return {
      ...((elements || groups || choices || sequence) && {
        oneOf: [
          ...(elements
            ? R.pipe(
                elements,
                R.map((element) => handleElement(element)),
              )
            : []),
          ...R.pipe(
            groups ?? [],
            R.map((group) => handleGroup(group, preserveChildrenOrder)),
          ),
          ...R.pipe(choices ?? [], R.map(handleChoice)),
          ...R.pipe(
            sequence ?? [],
            R.map((sequence) =>
              handleSequence(sequence, preserveChildrenOrder),
            ),
          ),
        ],
      }),
    };
  }
  return {
    ...((elements || groups || choices || sequence) && {
      allOf: [
        ...(elements
          ? [
              {
                properties: R.pipe(
                  elements,
                  R.map((element) => handleElement(element)),
                  R.mapToObj(({ title, ...other }) => [title, other]),
                ),
                // required: R.pipe(
                //   elements,
                //   R.filter((element) => element.$.minOccurs !== "0"),
                //   R.map((element) => element.$.name)
                // ),
              },
            ]
          : []),
        ...R.pipe(
          groups ?? [],
          R.map((group) => handleGroup(group, preserveChildrenOrder)),
        ),
        ...R.pipe(choices ?? [], R.map(handleChoice)),
        ...R.pipe(
          sequence ?? [],
          R.map((sequence) => handleSequence(sequence, preserveChildrenOrder)),
        ),
      ],
    }),
  };
}
function handleElement({
  $: { type, name, minOccurs, maxOccurs },
  $$,
}: Element): SetRequired<JSONSchema, "title"> {
  const annotation = $$?.["xs:annotation"]?.[0];
  const complexType = $$?.["xs:complexType"]?.[0];
  const min = isNonNullish(minOccurs) ? Number(minOccurs) : 0;
  const max =
    maxOccurs === "unbounded"
      ? undefined
      : isNullish(maxOccurs)
        ? 1
        : Number(maxOccurs);
  const isArray = max === undefined || max > 1;
  const schema = {
    title: name,
    allOf: [
      ...(type
        ? [
            (() => {
              const typee = handleType(type);
              if (typee.$ref) {
                return isSimpleType(type)
                  ? { properties: { _: typee }, required: ["_"] }
                  : typee;
              } else return { properties: { _: typee }, required: ["_"] };
            })(),
          ]
        : []),
      ...(complexType ? [handleComplexType(complexType)] : []),
      ...(preserveChildrenOrder
        ? [{ properties: { ["#name"]: { const: name } } }]
        : []),
    ],
    ...(annotation && handleAnnotation(annotation)),
  };
  // if ("score-partwise" === name)
  //   console.log(schema.allOf[0].allOf[1].properties.$$.items.oneOf[0]);
  return isArray
    ? {
        title: name,
        type: "array",
        items: schema,
        ...(min !== 0 && { minItems: min }),
        ...(isNonNullish(max) && { maxItems: max }),
      }
    : schema;
}
function handleChoice({ $, $$ }: Choice): JSONSchema {
  const elements = $$["xs:element"];
  const sequence = $$["xs:sequence"];
  const groups = $$["xs:group"];
  const choices = $$["xs:choice"];
  const minOccurs = $?.minOccurs;
  const maxOccurs = $?.maxOccurs;
  return {
    oneOf: [
      ...R.pipe(
        elements ?? [],
        R.map((element) =>
          handleElement({
            ...element,
            $: { ...element.$, minOccurs, maxOccurs },
          }),
        ),
        R.map(({ title, ...other }) => ({ properties: { [title]: other } })),
      ),
      ...R.pipe(groups ?? [], R.map(handleGroup)),
      ...R.pipe(
        sequence ?? [],
        R.map((sequence) => handleSequence(sequence, false)),
      ),
      ...R.pipe(choices ?? [], R.map(handleChoice)),
    ],
  };
}
function handleContent({ $$ }: SimpleContent | ComplexContent): JSONSchema {
  const extension = $$["xs:extension"][0];
  return {
    ...(extension && handleExtension(extension)),
  };
}
function handleExtension({ $, $$ }: Extension): JSONSchema {
  const attributes = $$?.["xs:attribute"];
  const attributeGroups = $$?.["xs:attributeGroup"];
  return {
    properties: {
      _: handleType($.base),
      $: {
        allOf: [
          ...(attributes
            ? [
                {
                  properties: R.pipe(
                    attributes,
                    R.map(handleAttribute),
                    R.mapToObj(({ title, ...other }) => [title, other]),
                  ),
                },
              ]
            : []),
          ...(attributeGroups?.map((attributeGroup) => ({
            $ref: "#/$defs/musicxml/attributeGroup/" + attributeGroup.$.ref,
          })) ?? []),
        ],
      },
      required: ["_", "$"],
    },
  };
}
function handleComplexType({ $, $$ }: ComplexType): JSONSchema {
  const annotation = $$?.["xs:annotation"]?.[0];
  const choice = $$?.["xs:choice"]?.[0];
  const sequence = $$?.["xs:sequence"]?.[0];
  const group = $$?.["xs:group"]?.[0];
  const attributeGroups = $$?.["xs:attributeGroup"];
  const attributes = $$?.["xs:attribute"];
  const simpleContent = $$?.["xs:simpleContent"]?.[0];
  const complexContent = $$?.["xs:complexContent"]?.[0];
  if ($?.name === "empty") {
    return {
      title: $.name,
      type: "object",
      properties: {},
      ...(annotation && handleAnnotation(annotation)),
    };
  }
  return {
    ...($?.name && { title: $.name }),
    ...(annotation && handleAnnotation(annotation)),
    // ...((choice || sequence || group) && {
    //   allOf: [
    //     ...(choice ? [handleChoice(choice)] : []),
    //     ...(sequence ? [handleSequence(sequence)] : []),
    //     ...(group ? [handleGroup(group)] : []),
    //     ...R.pipe(attributeGroups ?? [], R.map(handleAttributeGroup)),
    //     ...(attributes
    //       ? [
    //           {
    //             properties: R.pipe(
    //               attributes,
    //               R.map(handleAttribute),
    //               R.mapToObj(({ title, ...other }) => [title, other]),
    //             ),
    //           },
    //         ]
    //       : []),
    //   ],
    // }),
    allOf: [
      ...(preserveChildrenOrder
        ? [
            ...(choice ? [handleChoice(choice)] : []),
            ...(sequence ? [handleSequence(sequence)] : []),
            ...(group ? [handleGroup(group)] : []),
          ]
        : []),
      {
        properties: {
          ...((attributes || attributeGroups) && {
            $: {
              allOf: [
                ...R.pipe(attributeGroups ?? [], R.map(handleAttributeGroup)),
                ...(attributes
                  ? [
                      {
                        properties: R.pipe(
                          attributes,
                          R.map(handleAttribute),
                          R.mapToObj(({ title, ...other }) => [title, other]),
                        ),
                      },
                    ]
                  : []),
              ],
            },
          }),
          ...((choice || sequence || group) && {
            $$: {
              ...(preserveChildrenOrder
                ? {
                    type: "array",
                    items: (choice || sequence || group) && {
                      oneOf: [
                        ...(sequence
                          ? [handleSequence(sequence, preserveChildrenOrder)]
                          : []),
                        ...(choice ? [handleChoice(choice)] : []),
                        ...(group
                          ? [handleGroup(group, preserveChildrenOrder)]
                          : []),
                      ],
                    },
                  }
                : {
                    allOf: [
                      ...(choice ? [handleChoice(choice)] : []),
                      ...(sequence ? [handleSequence(sequence)] : []),
                      ...(group ? [handleGroup(group)] : []),
                    ],
                  }),
            },
          }),
          ...((simpleContent || complexContent) && {
            ...(simpleContent && handleContent(simpleContent).properties),
            ...(complexContent && handleContent(complexContent).properties),
          }),
        },
      },
    ],
    // required: [
    //   ...(choice || sequence || group ? ["$$"] : []),
    //   ...(simpleContent || complexContent ? ["_"] : []),
    // ],
  };
}
function handleReference(reference: string) {
  if (reference.includes("xml")) {
    return { $ref: "#/$defs/xml/attribute/" + reference.replace("xml:", "") };
  }
  if (reference.includes("xlink")) {
    return {
      $ref: "#/$defs/xlink/attribute/" + reference.replace("xlink:", ""),
    };
  }
}
function isSimpleType(type: string) {
  return musicxml["xs:schema"].$$["xs:simpleType"].some(
    (data: SimpleType) => data.$?.name === type,
  );
}

xsdToJsonSchema();
