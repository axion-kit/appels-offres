// Copie figée des fixtures C4 de la console (texte exact, ne pas modifier à la main : régénérer).
export const cellulesTexte = String.raw`{
  "instances": {
    "inst-0001": "auto-run-1",
    "inst-0002": "auto-run-1",
    "inst-0101": "auto-run-2"
  },
  "paquets": [
    {
      "nom": "instances de la cellule qui signe",
      "valide": true,
      "cle": "c4:auto-run-1:a",
      "corps": {
        "evenements": [
          {
            "type": "debut",
            "instanceId": "inst-0001",
            "executionId": "exec-0001",
            "a": "2026-10-24T10:00:00Z"
          },
          {
            "type": "debut",
            "instanceId": "inst-0002",
            "executionId": "exec-0001",
            "a": "2026-10-24T10:00:00Z"
          }
        ]
      }
    },
    {
      "nom": "instance d'une autre cellule",
      "valide": false,
      "cle": "c4:auto-run-1:a",
      "corps": {
        "evenements": [
          {
            "type": "debut",
            "instanceId": "inst-0101",
            "executionId": "exec-0001",
            "a": "2026-10-24T10:00:00Z"
          }
        ]
      }
    },
    {
      "nom": "paquet mixte refusé en entier",
      "valide": false,
      "cle": "c4:auto-run-1:a",
      "corps": {
        "evenements": [
          {
            "type": "debut",
            "instanceId": "inst-0001",
            "executionId": "exec-0001",
            "a": "2026-10-24T10:00:00Z"
          },
          {
            "type": "debut",
            "instanceId": "inst-0101",
            "executionId": "exec-0001",
            "a": "2026-10-24T10:00:00Z"
          }
        ]
      }
    },
    {
      "nom": "signal de vie au nom d'une autre cellule",
      "valide": false,
      "cle": "c4:auto-run-1:a",
      "corps": {
        "evenements": [
          {
            "type": "signal_de_vie",
            "instanceId": "inst-0001",
            "celluleId": "auto-run-2",
            "a": "2026-10-24T10:00:30Z"
          }
        ]
      }
    },
    {
      "nom": "clé qui n'est pas une clé de cellule",
      "valide": false,
      "cle": "cle-test-c1-console-a",
      "corps": {
        "evenements": [
          {
            "type": "debut",
            "instanceId": "inst-0001",
            "executionId": "exec-0001",
            "a": "2026-10-24T10:00:00Z"
          }
        ]
      }
    }
  ],
  "lectures": [
    {
      "nom": "configuration de sa propre instance",
      "valide": true,
      "cle": "c4:auto-run-2:b",
      "instanceId": "inst-0101"
    },
    {
      "nom": "configuration d'une instance d'une autre cellule",
      "valide": false,
      "cle": "c4:auto-run-2:b",
      "instanceId": "inst-0001"
    }
  ]
}
`;
export const jsonSchemaTexte = String.raw`{
  "version": "0.5.0",
  "routes": {
    "configuration": {
      "methode": "GET",
      "chemin": "/api/executeur/v1/instances/{instanceId}/configuration",
      "limite": "c4",
      "antiDoublon": "lecture"
    },
    "etatVoulu": {
      "methode": "GET",
      "chemin": "/api/executeur/v1/instances/{instanceId}/etat-voulu",
      "limite": "c4",
      "antiDoublon": "lecture"
    },
    "evenements": {
      "methode": "POST",
      "chemin": "/api/executeur/v1/evenements",
      "limite": "c4",
      "antiDoublon": "execution"
    }
  },
  "configuration": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "instanceId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,64}$"
      },
      "clientId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,64}$"
      },
      "automatisationId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,64}$"
      },
      "moduleCode": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9-]{1,62}$"
      },
      "moduleVersion": {
        "type": "string",
        "pattern": "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$"
      },
      "reglages": {
        "type": "object",
        "propertyNames": {
          "type": "string"
        },
        "additionalProperties": {
          "$ref": "#/$defs/__schema0"
        }
      },
      "dureeCacheSecondes": {
        "type": "integer",
        "minimum": 1,
        "maximum": 86400
      }
    },
    "required": [
      "instanceId",
      "clientId",
      "automatisationId",
      "moduleCode",
      "moduleVersion",
      "reglages",
      "dureeCacheSecondes"
    ],
    "additionalProperties": false,
    "$defs": {
      "__schema0": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "type": "number"
          },
          {
            "type": "boolean"
          },
          {
            "type": "null"
          },
          {
            "type": "array",
            "items": {
              "$ref": "#/$defs/__schema0"
            }
          },
          {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "$ref": "#/$defs/__schema0"
            }
          }
        ]
      }
    }
  },
  "etatVoulu": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "instanceId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{1,64}$"
      },
      "etat": {
        "type": "string",
        "enum": [
          "actif",
          "pause",
          "arrete"
        ]
      },
      "arretEnvois": {
        "type": "boolean"
      },
      "version": {
        "type": "integer",
        "minimum": 0,
        "maximum": 9007199254740991
      },
      "modeIa": {
        "type": "string",
        "enum": [
          "client_direct",
          "via_axion"
        ]
      },
      "droitsUsage": {
        "maxItems": 100,
        "type": "array",
        "items": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9-]{1,40}$"
        }
      },
      "paiementConstate": {
        "type": "boolean"
      },
      "enveloppeSignee": {
        "type": "object",
        "properties": {
          "version": {
            "type": "integer",
            "exclusiveMinimum": 0,
            "maximum": 9007199254740991
          },
          "charge": {
            "type": "string",
            "maxLength": 8192,
            "pattern": "^[A-Za-z0-9_-]+$"
          },
          "signature": {
            "type": "string",
            "minLength": 86,
            "maxLength": 86,
            "pattern": "^[A-Za-z0-9_-]+$"
          }
        },
        "required": [
          "version",
          "charge",
          "signature"
        ],
        "additionalProperties": false
      }
    },
    "required": [
      "instanceId",
      "etat",
      "arretEnvois",
      "version"
    ],
    "additionalProperties": false
  },
  "paquet": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "evenements": {
        "minItems": 1,
        "maxItems": 500,
        "type": "array",
        "items": {
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "const": "debut"
                },
                "instanceId": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{1,64}$"
                },
                "executionId": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{1,64}$"
                },
                "a": {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
                },
                "correlation": {
                  "type": "string",
                  "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
                }
              },
              "required": [
                "type",
                "instanceId",
                "executionId",
                "a"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "const": "fin"
                },
                "instanceId": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{1,64}$"
                },
                "executionId": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{1,64}$"
                },
                "dureeMs": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991
                },
                "elements": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991
                },
                "minutesGagnees": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991
                },
                "jetons": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991
                },
                "coutIaMicroCentimes": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991
                },
                "correlation": {
                  "type": "string",
                  "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
                },
                "ia": {
                  "type": "object",
                  "properties": {
                    "mode": {
                      "type": "string",
                      "enum": [
                        "client_direct",
                        "via_axion"
                      ]
                    },
                    "appels": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 9007199254740991
                    },
                    "jetonsEntree": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 9007199254740991
                    },
                    "jetonsSortie": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 9007199254740991
                    }
                  },
                  "required": [
                    "mode",
                    "appels",
                    "jetonsEntree",
                    "jetonsSortie"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "type",
                "instanceId",
                "executionId",
                "dureeMs",
                "elements",
                "minutesGagnees",
                "jetons",
                "coutIaMicroCentimes"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "const": "erreur"
                },
                "instanceId": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{1,64}$"
                },
                "executionId": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{1,64}$"
                },
                "classe": {
                  "type": "string",
                  "enum": [
                    "passagere",
                    "quota",
                    "identification",
                    "definitive"
                  ]
                },
                "code": {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9_]{2,63}$"
                }
              },
              "required": [
                "type",
                "instanceId",
                "executionId",
                "classe",
                "code"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "const": "a_trancher"
                },
                "instanceId": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{1,64}$"
                },
                "executionId": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{1,64}$"
                },
                "etape": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{1,64}$"
                },
                "code": {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9_]{2,63}$"
                }
              },
              "required": [
                "type",
                "instanceId",
                "executionId",
                "etape",
                "code"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "const": "etape"
                },
                "instanceId": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{1,64}$"
                },
                "executionId": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{1,64}$"
                },
                "etape": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{1,64}$"
                },
                "correlation": {
                  "type": "string",
                  "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
                }
              },
              "required": [
                "type",
                "instanceId",
                "executionId",
                "etape",
                "correlation"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "const": "action_ecran"
                },
                "instanceId": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{1,64}$"
                },
                "action": {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9-]{1,40}$"
                },
                "correlation": {
                  "type": "string",
                  "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
                },
                "a": {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
                }
              },
              "required": [
                "type",
                "instanceId",
                "action",
                "correlation",
                "a"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "const": "signal_de_vie"
                },
                "instanceId": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{1,64}$"
                },
                "celluleId": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_-]{1,64}$"
                },
                "a": {
                  "type": "string",
                  "format": "date-time",
                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"
                }
              },
              "required": [
                "type",
                "instanceId",
                "celluleId",
                "a"
              ],
              "additionalProperties": false
            }
          ]
        }
      }
    },
    "required": [
      "evenements"
    ],
    "additionalProperties": false
  }
}
`;
export const paquetsTexte = String.raw`{
  "cas": [
    { "nom": "debut puis fin", "valide": true, "corps": { "evenements": [
      { "type": "debut", "instanceId": "inst-0001", "executionId": "exec-0001", "a": "2026-10-24T10:00:00Z" },
      { "type": "fin", "instanceId": "inst-0001", "executionId": "exec-0001", "dureeMs": 1200, "elements": 3, "minutesGagnees": 15, "jetons": 800, "coutIaMicroCentimes": 4200 }
    ] } },
    { "nom": "signal de vie seul", "valide": true, "corps": { "evenements": [
      { "type": "signal_de_vie", "instanceId": "inst-0001", "celluleId": "auto-run-1", "a": "2026-10-24T10:00:30Z" }
    ] } },
    { "nom": "signal de vie sans cellule", "valide": false, "corps": { "evenements": [
      { "type": "signal_de_vie", "instanceId": "inst-0001", "a": "2026-10-24T10:00:30Z" }
    ] } },
    { "nom": "a trancher avec code fermé", "valide": true, "corps": { "evenements": [
      { "type": "a_trancher", "instanceId": "inst-0001", "executionId": "exec-0001", "etape": "accuser", "code": "effet_incertain" }
    ] } },
    { "nom": "a trancher avec message libre", "valide": false, "corps": { "evenements": [
      { "type": "a_trancher", "instanceId": "inst-0001", "executionId": "exec-0001", "etape": "accuser", "code": "effet_incertain", "message": "texte libre" }
    ] } },
    { "nom": "erreur avec message libre", "valide": false, "corps": { "evenements": [
      { "type": "erreur", "instanceId": "inst-0001", "executionId": "exec-0001", "classe": "definitive", "code": "refus_outil", "message": "texte libre" }
    ] } },
    { "nom": "coût IA flottant", "valide": false, "corps": { "evenements": [
      { "type": "fin", "instanceId": "inst-0001", "executionId": "exec-0001", "dureeMs": 1, "elements": 1, "minutesGagnees": 1, "jetons": 1, "coutIaMicroCentimes": 0.5 }
    ] } },
    { "nom": "0.4.0 : debut, etape, fin avec corrélation et mode d'IA, action d'écran", "valide": true, "corps": { "evenements": [
      { "type": "debut", "instanceId": "inst-0001", "executionId": "exec-0001", "a": "2026-10-24T10:00:00Z", "correlation": "3b241101-e2bb-4255-8caf-4136c566a962" },
      { "type": "etape", "instanceId": "inst-0001", "executionId": "exec-0001", "etape": "accuser", "correlation": "3b241101-e2bb-4255-8caf-4136c566a962" },
      { "type": "fin", "instanceId": "inst-0001", "executionId": "exec-0001", "dureeMs": 1200, "elements": 3, "minutesGagnees": 15, "jetons": 800, "coutIaMicroCentimes": 4200, "correlation": "3b241101-e2bb-4255-8caf-4136c566a962", "ia": { "mode": "via_axion", "appels": 2, "jetonsEntree": 600, "jetonsSortie": 200 } },
      { "type": "action_ecran", "instanceId": "inst-0001", "action": "changer-statut", "correlation": "3b241101-e2bb-4255-8caf-4136c566a962", "a": "2026-10-24T10:00:05Z" }
    ] } },
    { "nom": "0.4.0 : corrélation qui n'est pas un UUID v4", "valide": false, "corps": { "evenements": [
      { "type": "debut", "instanceId": "inst-0001", "executionId": "exec-0001", "a": "2026-10-24T10:00:00Z", "correlation": "exec-0001" }
    ] } },
    { "nom": "0.4.0 : etape sans corrélation", "valide": false, "corps": { "evenements": [
      { "type": "etape", "instanceId": "inst-0001", "executionId": "exec-0001", "etape": "accuser" }
    ] } }
  ]
}
`;
