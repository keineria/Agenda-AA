/** Códigos ISO 3166-1 alfa-2. Los nombres salen de Intl.DisplayNames en el idioma del cliente. */
export const COUNTRY_CODES = (
  "AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR XK KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PS PA PG PY PE PH PL PT PR QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW"
).split(" ");

const PRIORITY = ["US", "MX", "DO", "CO", "EC", "GT", "HN", "SV", "PE", "VE", "PR", "CU", "NI", "CR", "PA", "AR", "CL", "BR"];

export function countryOptions(locale: "es" | "en"): { value: string; label: string }[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale === "es" ? "es" : "en"], { type: "region" });
  } catch {
    names = null;
  }
  const label = (c: string) => names?.of(c) ?? c;
  const top = PRIORITY.map((c) => ({ value: c, label: label(c) }));
  const rest = COUNTRY_CODES.filter((c) => !PRIORITY.includes(c))
    .map((c) => ({ value: c, label: label(c) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
  return [...top, { value: "", label: "──────────" }, ...rest];
}

export function countryName(code: string, locale: "es" | "en"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
