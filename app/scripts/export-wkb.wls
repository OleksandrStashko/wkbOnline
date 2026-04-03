Get["C:\\Users\\Oleksandr\\Desktop\\CODEX\\Projects\\wkbOnline\\WKB.m"];

vars = Join[{K}, Table[Symbol["V" <> ToString[j]], {j, 2, 32}]];
exprs = WKBOrderList[n, Join[{V0}, Table[Symbol["V" <> ToString[k]], {k, 2, 32}]]];
transformed = exprs /. (n + 1/2) -> K /. (1/2 + n) -> K;

serializeFactors[powers_List] := Cases[
  MapIndexed[If[#1 === 0, Nothing, {First[#2] - 1, #1}] &, powers],
  {_Integer, _Integer}
];

serializeRestFactors[powers_List] := Cases[
  MapIndexed[If[First[#2] == 1 || #1 === 0, Nothing, {First[#2] - 1, #1}] &, powers],
  {_Integer, _Integer}
];

serializeGroups[rules_List] := Module[{grouped},
  grouped = GroupBy[rules, serializeRestFactors[First[#]] &];
  Map[
    Function[factors,
      Module[{bucket, byK, coeffs},
        bucket = grouped[factors];
        byK = GroupBy[bucket, First[First[#]] &];
        coeffs = Association @ KeyValueMap[
          (#1 -> ToString[InputForm[Total[Last /@ #2]]]) &,
          byK
        ];
        <|
          "key" -> StringRiffle[Map[ToString[#[[1]]] <> ":" <> ToString[#[[2]]] &, factors], "|"],
          "factors" -> factors,
          "coeffs" -> Table[If[KeyExistsQ[coeffs, k], coeffs[k], Null], {k, 0, Max[Keys[coeffs]]}]
        |>
      ]
    ],
    Keys[grouped]
  ]
];

serializeTerm[order_Integer] := Module[{expr, normalized, together, den, v2Power, denConst, rules, terms},
  expr = transformed[[order + 1]];
  normalized = If[order > 1 && OddQ[order], expr/(-I*K*Sqrt[-2*V2]), expr];
  together = Together[normalized];
  den = Denominator[together];
  v2Power = Exponent[den, V2];
  denConst = Expand[den /. V2 -> 1];
  rules = CoefficientRules[Expand[Numerator[together]], vars];
  <|
    "order" -> order,
    "oddFactor" -> If[order > 1 && OddQ[order], "barrier", If[order == 1, "eikonal", "none"]],
    "v2Power" -> v2Power,
    "denConst" -> ToString[InputForm[denConst]],
    "groups" -> If[order == 1, {}, serializeGroups[rules]]
  |>
];

data = <|
  "maxOrder" -> 16,
  "variables" -> Join[{"K"}, Table["V" <> ToString[j], {j, 2, 32}]],
  "orders" -> Table[serializeTerm[order], {order, 1, 16}]
|>;

Export["C:\\Users\\Oleksandr\\Desktop\\CODEX\\Projects\\wkbOnline\\app\\data\\wkb-raw.json", data, "JSON", "Compact" -> True];
