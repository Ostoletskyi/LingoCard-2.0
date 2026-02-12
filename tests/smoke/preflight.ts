import { CardSchema } from "../../src/model/cardSchema";
import { BoxSchema } from "../../src/model/layoutSchema";

export const preflight = () => {
  CardSchema.parse({
    id: "test",
    inf: "sein",
    freq: 3,
    tags: [],
    tr_1_ru: "быть",
    tr_1_ctx: "",
    tr_2_ru: "",
    tr_2_ctx: "",
    tr_3_ru: "",
    tr_3_ctx: "",
    tr_4_ru: "",
    tr_4_ctx: "",
    forms_p3: "ist",
    forms_prat: "war",
    forms_p2: "gewesen",
    forms_aux: "sein",
    syn_1_de: "",
    syn_1_ru: "",
    syn_2_de: "",
    syn_2_ru: "",
    syn_3_de: "",
    syn_3_ru: "",
    ex_1_de: "",
    ex_1_ru: "",
    ex_1_tag: "",
    ex_2_de: "",
    ex_2_ru: "",
    ex_2_tag: "",
    ex_3_de: "",
    ex_3_ru: "",
    ex_3_tag: "",
    ex_4_de: "",
    ex_4_ru: "",
    ex_4_tag: "",
    ex_5_de: "",
    ex_5_ru: "",
    ex_5_tag: "",
    rek_1_de: "",
    rek_1_ru: "",
    rek_2_de: "",
    rek_2_ru: "",
    rek_3_de: "",
    rek_3_ru: "",
    rek_4_de: "",
    rek_4_ru: "",
    rek_5_de: "",
    rek_5_ru: ""
  });

  BoxSchema.parse({
    id: "box",
    xMm: 0,
    yMm: 0,
    wMm: 10,
    hMm: 10,
    z: 1,
    fieldId: "inf",
    style: {
      fontSizePt: 12,
      fontWeight: "normal",
      align: "left",
      lineHeight: 1.2,
      paddingMm: 0
    }
  });
};
