import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AgnosticGeometryError,
  projectAgnosticGeometry
} from '../src/core/agnosticGeometry.js';

import {
  MetalconConstructiveGeometryError,
  buildMetalconWallFrameB32,
  inspectMetalconSelectedWallGeometryB32,
  inspectMetalconWallGeometryB32
} from '../src/core/metalconConstructiveGeometry.js';

function wallX(
  overrides = {}
) {
  const host = {
    id: 100,
    type: 'wall',
    prism: {
      kind: 'oriented-prism',
      start: {
        x: 1000,
        y: 2000,
        z: 450
      },
      end: {
        x: 5000,
        y: 2000,
        z: 450
      },
      thickness: 101.1,
      height: 2800
    },
    openings: []
  };

  return {
    ...host,
    ...structuredClone(overrides),
    prism: {
      ...host.prism,
      ...(overrides.prism ?? {}),
      start: {
        ...host.prism.start,
        ...(overrides.prism?.start ?? {})
      },
      end: {
        ...host.prism.end,
        ...(overrides.prism?.end ?? {})
      }
    },
    openings:
      overrides.openings === undefined
        ? []
        : structuredClone(
          overrides.openings
        )
  };
}

function wallY(
  overrides = {}
) {
  return wallX({
    ...overrides,
    prism: {
      start: {
        x: 3000,
        y: 1000,
        z: 450
      },
      end: {
        x: 3000,
        y: 5000,
        z: 450
      },
      ...(overrides.prism ?? {})
    }
  });
}

function upstreamBoundaryWallModel(
  transverseDelta
) {
  return {
    modelVersion: 2,
    grid: {
      xAxes: [
        {
          id: 'BUG026-X0',
          position: 0
        },
        {
          id: 'BUG026-X1',
          position: 4000
        }
      ],
      yAxes: [
        {
          id: 'BUG026-Y0',
          position: 0
        },
        {
          id: 'BUG026-Y1',
          position: transverseDelta
        }
      ],
      zLevels: [
        {
          id: 'BUG026-Z0',
          elevation: 0
        },
        {
          id: 'BUG026-Z1',
          elevation: 2400
        }
      ]
    },
    elements: [
      {
        id: 'BUG026-W1',
        type: 'wall',
        direction: 'x',
        xStart: 'BUG026-X0',
        xEnd: 'BUG026-X1',
        yStart: 'BUG026-Y0',
        yEnd: 'BUG026-Y1',
        bottomZ: 'BUG026-Z0',
        topZ: 'BUG026-Z1',
        thickness: 90,
        openings: []
      }
    ],
    projectParams: [],
    roofSystems: [],
    roofPlanes: []
  };
}

function openingX({
  id = 200,
  startX = 1500,
  endX = 2500,
  startZ = 450,
  endZ = 450,
  y = 2000,
  height = 2100,
  thickness = 101.1,
  kind = 'door',
  hostWallId = 100,
  voidKind = 'oriented-prism'
} = {}) {
  return {
    id,
    kind,
    hostWallId,
    void: {
      kind: voidKind,
      start: {
        x: startX,
        y,
        z: startZ
      },
      end: {
        x: endX,
        y,
        z: endZ
      },
      thickness,
      height
    }
  };
}

function openingY({
  id = 200,
  startY = 1500,
  endY = 2500,
  startZ = 450,
  endZ = 450,
  x = 3000,
  height = 2100,
  thickness = 101.1,
  kind = 'door',
  hostWallId = 100,
  voidKind = 'oriented-prism'
} = {}) {
  return {
    id,
    kind,
    hostWallId,
    void: {
      kind: voidKind,
      start: {
        x,
        y: startY,
        z: startZ
      },
      end: {
        x,
        y: endY,
        z: endZ
      },
      thickness,
      height
    }
  };
}

function expectCode(
  action,
  code
) {
  assert.throws(
    action,
    (error) => (
      error
        instanceof MetalconConstructiveGeometryError
      && error.code === code
    )
  );
}

test(
  'SPEC-016-B B3.2: host X exacto produce frame canónico',
  () => {
    assert.deepEqual(
      buildMetalconWallFrameB32(
        wallX()
      ),
      {
        axis: 'x',
        start: {
          x: 1000,
          y: 2000,
          z: 450
        },
        end: {
          x: 5000,
          y: 2000,
          z: 450
        },
        L: 4000,
        z0: 450,
        z1: 3250,
        thickness: 101.1
      }
    );
  }
);

test(
  'SPEC-016-B B3.2: host Y exacto produce frame canónico',
  () => {
    const frame =
      buildMetalconWallFrameB32(
        wallY()
      );

    assert.equal(frame.axis, 'y');
    assert.equal(frame.L, 4000);
    assert.equal(frame.z0, 450);
    assert.equal(frame.z1, 3250);
  }
);

test(
  'SPEC-016-B B3.2: invertir start/end del host no cambia el frame',
  () => {
    const normal =
      wallX();

    const reversed =
      wallX({
        prism: {
          start:
            normal.prism.end,
          end:
            normal.prism.start
        }
      });

    assert.deepEqual(
      buildMetalconWallFrameB32(
        reversed
      ),
      buildMetalconWallFrameB32(
        normal
      )
    );
  }
);

test(
  'BUG-016-B-024: invertir start/end del host Y no cambia el frame',
  () => {
    const normal =
      wallY();

    const reversed =
      wallY({
        prism: {
          start:
            normal.prism.end,
          end:
            normal.prism.start
        }
      });

    assert.deepEqual(
      buildMetalconWallFrameB32(
        reversed
      ),
      buildMetalconWallFrameB32(
        normal
      )
    );
  }
);

for (
  const delta
  of [
    0.05,
    0.1,
    0.1001
  ]
) {
  test(
    `BUG-016-B-024: host X con desviación transversal ${delta} mm falla cerrado`,
    () => {
      expectCode(
        () =>
          buildMetalconWallFrameB32(
            wallX({
              prism: {
                end: {
                  y:
                    2000 + delta
                }
              }
            })
          ),
        'INVALID_METALCON_B32_HOST_FRAME'
      );
    }
  );
}

test(
  'BUG-016-B-024: host Y con desviación transversal 0.05 mm falla cerrado',
  () => {
    expectCode(
      () =>
        buildMetalconWallFrameB32(
          wallY({
            prism: {
              end: {
                x: 3000.05,
                y: 5000,
                z: 450
              }
            }
          })
        ),
      'INVALID_METALCON_B32_HOST_FRAME'
    );
  }
);

for (
  const delta
  of [
    0.05,
    0.1,
    0.1001
  ]
) {
  test(
    `BUG-016-B-024: host con desnivel ${delta} mm falla cerrado`,
    () => {
      expectCode(
        () =>
          buildMetalconWallFrameB32(
            wallX({
              prism: {
                end: {
                  z:
                    450 + delta
                }
              }
            })
          ),
        'INVALID_METALCON_B32_HOST_FRAME'
      );
    }
  );
}

test(
  'BUG-016-B-024: host diagonal falla cerrado',
  () => {
    expectCode(
      () =>
        buildMetalconWallFrameB32(
          wallX({
            prism: {
              end: {
                y: 2100
              }
            }
          })
        ),
      'INVALID_METALCON_B32_HOST_FRAME'
    );
  }
);

test(
  'BUG-016-B-026: WALL upstream con desviación 1e-7 se publica pero B3.2 falla cerrado',
  () => {
    const projected =
      projectAgnosticGeometry(
        upstreamBoundaryWallModel(
          1e-7
        )
      );

    const host =
      projected.elements[0];

    assert.equal(
      host.prism.start.y,
      0
    );

    assert.equal(
      host.prism.end.y,
      1e-7
    );

    expectCode(
      () =>
        buildMetalconWallFrameB32(
          host
        ),
      'INVALID_METALCON_B32_HOST_FRAME'
    );
  }
);

test(
  'BUG-016-B-026: desviación transversal mayor que 1e-7 falla upstream',
  () => {
    assert.throws(
      () =>
        projectAgnosticGeometry(
          upstreamBoundaryWallModel(
            1e-6
          )
        ),
      (error) => (
        error
          instanceof AgnosticGeometryError
        && error.code === 'INVALID_DIMENSION'
      )
    );
  }
);

test(
  'BUG-016-B-024/026: host casi ortogonal falla cerrado',
  () => {
    expectCode(
      () =>
        buildMetalconWallFrameB32(
          wallX({
            prism: {
              end: {
                y: 2000.00000001
              }
            }
          })
        ),
      'INVALID_METALCON_B32_HOST_FRAME'
    );
  }
);

test(
  'BUG-016-B-024/026: host casi nivelado falla cerrado',
  () => {
    expectCode(
      () =>
        buildMetalconWallFrameB32(
          wallX({
            prism: {
              end: {
                z: 450.00000001
              }
            }
          })
        ),
      'INVALID_METALCON_B32_HOST_FRAME'
    );
  }
);

test(
  'SPEC-016-B B3.2: longitud plana cero falla cerrado',
  () => {
    expectCode(
      () =>
        buildMetalconWallFrameB32(
          wallX({
            prism: {
              end: {
                x: 1000
              }
            }
          })
        ),
      'INVALID_METALCON_B32_HOST_FRAME'
    );
  }
);

test(
  'SPEC-016-B B3.2: coordenada no finita falla cerrado',
  () => {
    expectCode(
      () =>
        buildMetalconWallFrameB32(
          wallX({
            prism: {
              end: {
                x: Number.NaN
              }
            }
          })
        ),
      'INVALID_METALCON_B32_HOST_COORDINATES'
    );
  }
);

for (
  const [
    label,
    prism
  ]
  of [
    [
      'kind inválido',
      {
        kind: 'box'
      }
    ],
    [
      'height no finito',
      {
        height: Number.NaN
      }
    ],
    [
      'height cero',
      {
        height: 0
      }
    ],
    [
      'height negativo',
      {
        height: -1
      }
    ],
    [
      'thickness no finito',
      {
        thickness: Number.NaN
      }
    ],
    [
      'thickness cero',
      {
        thickness: 0
      }
    ],
    [
      'thickness negativo',
      {
        thickness: -1
      }
    ]
  ]
) {
  test(
    `BUG-016-B-028: ${label} falla cerrado`,
    () => {
      expectCode(
        () =>
          buildMetalconWallFrameB32(
            wallX({
              prism
            })
          ),
        'INVALID_METALCON_B32_HOST_PRISM'
      );
    }
  );
}

test(
  'SPEC-016-B B3.2: opening X exacto se convierte directamente a Oi',
  () => {
    const result =
      inspectMetalconWallGeometryB32(
        wallX({
          openings: [
            openingX()
          ]
        })
      );

    assert.deepEqual(
      result.openings,
      [
        {
          openingId: 200,
          kind: 'door',
          sMin: 500,
          sMax: 1500,
          zMin: 450,
          zMax: 2550
        }
      ]
    );
  }
);

test(
  'SPEC-016-B B3.2: opening Y exacto se convierte directamente a Oi',
  () => {
    const result =
      inspectMetalconWallGeometryB32(
        wallY({
          openings: [
            openingY()
          ]
        })
      );

    assert.deepEqual(
      result.openings[0],
      {
        openingId: 200,
        kind: 'door',
        sMin: 500,
        sMax: 1500,
        zMin: 450,
        zMax: 2550
      }
    );
  }
);

test(
  'SPEC-016-B B3.2: invertir start/end del opening produce el mismo Oi',
  () => {
    const normal =
      inspectMetalconWallGeometryB32(
        wallX({
          openings: [
            openingX()
          ]
        })
      );

    const reversed =
      inspectMetalconWallGeometryB32(
        wallX({
          openings: [
            openingX({
              startX: 2500,
              endX: 1500
            })
          ]
        })
      );

    assert.deepEqual(
      reversed,
      normal
    );
  }
);

for (
  const [
    label,
    opening,
    code
  ]
  of [
    [
      'hostWallId incorrecto',
      openingX({
        hostWallId: 999
      }),
      'INVALID_METALCON_B32_OPENING'
    ],
    [
      'kind inválido',
      openingX({
        kind: 'hole'
      }),
      'INVALID_METALCON_B32_OPENING'
    ],
    [
      'void.kind inválido',
      openingX({
        voidKind: 'box'
      }),
      'INVALID_METALCON_B32_OPENING'
    ],
    [
      'coordenada no finita',
      openingX({
        startX: Number.NaN
      }),
      'INVALID_METALCON_B32_OPENING'
    ],
    [
      'height cero',
      openingX({
        height: 0
      }),
      'INVALID_METALCON_B32_OPENING'
    ],
    [
      'height negativo',
      openingX({
        height: -1
      }),
      'INVALID_METALCON_B32_OPENING'
    ],
    [
      'thickness cero',
      openingX({
        thickness: 0
      }),
      'INVALID_METALCON_B32_OPENING'
    ],
    [
      'thickness negativo',
      openingX({
        thickness: -1
      }),
      'INVALID_METALCON_B32_OPENING'
    ],
    [
      'thickness distinto del host',
      openingX({
        thickness: 101.1001
      }),
      'INVALID_METALCON_B32_OPENING'
    ],
    [
      'longitud longitudinal cero',
      openingX({
        startX: 1500,
        endX: 1500
      }),
      'INVALID_METALCON_B32_OPENING_FRAME'
    ],
    [
      'start.z distinto de end.z',
      openingX({
        endZ: 450.0001
      }),
      'INVALID_METALCON_B32_OPENING_FRAME'
    ],
    [
      'desviación transversal positiva',
      openingX({
        y: 2000.0005
      }),
      'INVALID_METALCON_B32_OPENING_FRAME'
    ]
  ]
) {
  test(
    `BUG-016-B-027: ${label} falla cerrado`,
    () => {
      expectCode(
        () =>
          inspectMetalconWallGeometryB32(
            wallX({
              openings: [
                opening
              ]
            })
          ),
        code
      );
    }
  );
}

test(
  'D-080: contacto exacto con los cuatro bordes de M es válido',
  () => {
    const result =
      inspectMetalconWallGeometryB32(
        wallX({
          openings: [
            openingX({
              startX: 1000,
              endX: 5000,
              startZ: 450,
              endZ: 450,
              height: 2800
            })
          ]
        })
      );

    assert.deepEqual(
      result.openings[0],
      {
        openingId: 200,
        kind: 'door',
        sMin: 0,
        sMax: 4000,
        zMin: 450,
        zMax: 3250
      }
    );
  }
);

for (
  const [
    label,
    opening
  ]
  of [
    [
      'exceso longitudinal izquierdo mínimo',
      openingX({
        startX: 999.9999
      })
    ],
    [
      'exceso longitudinal derecho mínimo',
      openingX({
        endX: 5000.0001
      })
    ],
    [
      'exceso inferior mínimo',
      openingX({
        startZ: 449.9999,
        endZ: 449.9999
      })
    ],
    [
      'exceso superior mínimo',
      openingX({
        startZ: 1150.0001,
        endZ: 1150.0001,
        height: 2100
      })
    ]
  ]
) {
  test(
    `D-080: ${label} falla cerrado sin tolerancia`,
    () => {
      expectCode(
        () =>
          inspectMetalconWallGeometryB32(
            wallX({
              openings: [
                opening
              ]
            })
          ),
        'METALCON_B32_OPENING_OUTSIDE_HOST'
      );
    }
  );
}

test(
  'D-079: contacto exacto de borde entre openings es válido',
  () => {
    const result =
      inspectMetalconWallGeometryB32(
        wallX({
          openings: [
            openingX({
              id: 201,
              startX: 1200,
              endX: 2000
            }),
            openingX({
              id: 202,
              startX: 2000,
              endX: 2800
            })
          ]
        })
      );

    assert.equal(
      result.openings.length,
      2
    );
  }
);

test(
  'D-079: solape 2D positivo menor que 0.1 mm falla cerrado',
  () => {
    expectCode(
      () =>
        inspectMetalconWallGeometryB32(
          wallX({
            openings: [
              openingX({
                id: 201,
                startX: 1200,
                endX: 2000
              }),
              openingX({
                id: 202,
                startX: 1999.95,
                endX: 2800
              })
            ]
          })
        ),
      'METALCON_B32_OPENING_OVERLAP'
    );
  }
);

test(
  'D-079: solape sólo longitudinal sin solape Z es válido',
  () => {
    const result =
      inspectMetalconWallGeometryB32(
        wallX({
          openings: [
            openingX({
              id: 201,
              startX: 1200,
              endX: 2200,
              startZ: 450,
              endZ: 450,
              height: 1000
            }),
            openingX({
              id: 202,
              startX: 1800,
              endX: 2800,
              startZ: 1450,
              endZ: 1450,
              height: 1000
            })
          ]
        })
      );

    assert.equal(
      result.openings.length,
      2
    );
  }
);

test(
  'SPEC-016-B B3.2: FX-008 gobernante sin openings produce dominio esperado',
  () => {
    const result =
      inspectMetalconWallGeometryB32({
        id: 1784606313849,
        type: 'wall',
        prism: {
          kind: 'oriented-prism',
          start: {
            x: 4200,
            y: 3000,
            z: 450
          },
          end: {
            x: 8600,
            y: 3000,
            z: 450
          },
          thickness: 101.1,
          height: 2800
        },
        openings: []
      });

    assert.deepEqual(
      result,
      {
        hostId:
          1784606313849,
        frame: {
          axis: 'x',
          start: {
            x: 4200,
            y: 3000,
            z: 450
          },
          end: {
            x: 8600,
            y: 3000,
            z: 450
          },
          L: 4400,
          z0: 450,
          z1: 3250,
          thickness: 101.1
        },
        openings: []
      }
    );
  }
);

test(
  'SPEC-016-B B3.2: target seleccionado válido se inspecciona',
  () => {
    const result =
      inspectMetalconSelectedWallGeometryB32({
        effectiveGeometry: {
          elements: [
            wallX()
          ]
        },
        configuration: {
          constructionSelections: [
            {
              elementId: 100
            }
          ]
        }
      });

    assert.equal(
      result.length,
      1
    );

    assert.equal(
      result[0].hostId,
      100
    );

    assert.equal(
      result[0].frame.axis,
      'x'
    );
  }
);

test(
  'SPEC-016-B B3.2: cero constructionSelections no materializa contexto',
  () => {
    const result =
      inspectMetalconSelectedWallGeometryB32({
        effectiveGeometry: {
          elements: [
            wallX({
              prism: {
                end: {
                  y: 2000.0001
                }
              }
            })
          ]
        },
        configuration: {
          constructionSelections: []
        }
      });

    assert.deepEqual(
      result,
      []
    );
  }
);

test(
  'SPEC-016-B B3.2: geometría contextual inválida no seleccionada no bloquea',
  () => {
    const selected =
      wallX({
        id: 100
      });

    const contextualInvalid =
      wallX({
        id: 101,
        prism: {
          end: {
            y: 2000.0001
          }
        }
      });

    const result =
      inspectMetalconSelectedWallGeometryB32({
        effectiveGeometry: {
          elements: [
            selected,
            contextualInvalid
          ]
        },
        configuration: {
          constructionSelections: [
            {
              elementId: 100
            }
          ]
        }
      });

    assert.deepEqual(
      result.map(
        (entry) => entry.hostId
      ),
      [100]
    );
  }
);

test(
  'SPEC-016-B B3.2: target seleccionado ausente falla cerrado',
  () => {
    expectCode(
      () =>
        inspectMetalconSelectedWallGeometryB32({
          effectiveGeometry: {
            elements: [
              wallX()
            ]
          },
          configuration: {
            constructionSelections: [
              {
                elementId: 999
              }
            ]
          }
        }),
      'METALCON_B32_SELECTED_HOST_NOT_UNIQUE'
    );
  }
);

test(
  'SPEC-016-B B3.2: target seleccionado no-WALL falla cerrado',
  () => {
    expectCode(
      () =>
        inspectMetalconSelectedWallGeometryB32({
          effectiveGeometry: {
            elements: [
              wallX({
                type: 'foundation'
              })
            ]
          },
          configuration: {
            constructionSelections: [
              {
                elementId: 100
              }
            ]
          }
        }),
      'INVALID_METALCON_B32_HOST'
    );
  }
);
