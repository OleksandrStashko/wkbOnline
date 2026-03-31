Get["C:\\Users\\Oleksandr\\Desktop\\CODEX\\Projects\\wkbOnline\\WKB.m"];

vars = Join[{K}, Table[Symbol["V" <> ToString[j]], {j, 2, 26}]];
exprs = WKBOrderList[n, Join[{V0}, Table[Symbol["V" <> ToString[k]], {k, 2, 26}]]];
transformed = exprs /. (n + 1/2) -> K /. (1/2 + n) -> K;

serializeTerm[order_Integer] := Module[{expr, normalized, together, den, v2Power, denConst, rules, terms},
  expr = transformed[[order + 1]];
  normalized = If[order > 1 && OddQ[order], expr/(-I*K*Sqrt[-2*V2]), expr];
  together = Together[normalized];
  den = Denominator[together];
  v2Power = Exponent[den, V2];
  denConst = Expand[den /. V2 -> 1];
  rules = CoefficientRules[Expand[Numerator[together]], vars];
  terms = Map[
    Function[rule,
      <|
        "powers" -> rule[[1]],
        "coeff" -> ToString[InputForm[rule[[2]]]]
      |>
    ],
    rules
  ];
  <|
    "order" -> order,
    "oddFactor" -> If[order > 1 && OddQ[order], "barrier", If[order == 1, "eikonal", "none"]],
    "v2Power" -> v2Power,
    "denConst" -> ToString[InputForm[denConst]],
    "terms" -> terms
  |>
];

data = <|
  "maxOrder" -> 13,
  "variables" -> Join[{"K"}, Table["V" <> ToString[j], {j, 2, 26}]],
  "orders" -> Table[serializeTerm[order], {order, 1, 13}]
|>;

Export["C:\\Users\\Oleksandr\\Desktop\\CODEX\\Projects\\wkbOnline\\app\\data\\wkb-raw.json", data, "JSON", "Compact" -> True];
