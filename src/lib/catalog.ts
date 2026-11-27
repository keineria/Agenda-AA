/**
 * Catálogo de servicios y formularios de agendamiento.
 *
 * Fuente: Google Sheet "Especificacion Agendamiento de Citas - AA Solutions Services"
 * (pestañas Tipos_de_Cita, Esquema_Campos_Formulario y Terminos_y_Condiciones).
 * Las versiones en inglés del Sheet (APT-05, APT-06) se unificaron con las de español:
 * cada formulario tiene etiquetas ES/EN y el idioma lo elige el cliente.
 *
 * Las opciones marcadas "[Pendiente extraer opciones]" en el Sheet se completaron con
 * valores estándar del IRS y se señalan con `// PROVISIONAL` para validarlas con AA Solutions.
 */

export type Locale = "es" | "en";
export type L10n = { es: string; en: string };

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "date"
  | "number"
  | "textarea"
  | "select"
  | "radio"
  | "yesno"
  | "checkbox_group"
  | "checkbox"
  | "file"
  | "us_state"
  | "country";

export interface FieldOption {
  value: string;
  label: L10n;
}

export interface Condition {
  field: string;
  /** El campo se muestra si el valor (o alguno de los valores en checkbox_group) está en esta lista. */
  in: string[];
}

export interface FieldDef {
  key: string;
  type: FieldType;
  label: L10n;
  help?: L10n;
  placeholder?: L10n;
  required?: boolean;
  options?: FieldOption[];
  /** Dato sensible (PII): se cifra en la base de datos y se enmascara en Google Sheets. */
  sensitive?: boolean;
  /** Patrón de validación (regex) aplicado al valor sin espacios. */
  pattern?: string;
  patternMessage?: L10n;
  /** Si se define, el campo solo se muestra/valida cuando se cumple la condición. */
  showIf?: Condition;
  /** Ocupa todo el ancho en escritorio. */
  wide?: boolean;
  /** Para checkbox obligatorio o yesno que debe ser "yes". */
  mustBeTrue?: boolean;
}

export interface SectionDef {
  id: string;
  title: L10n;
  intro?: L10n;
  fields: FieldDef[];
}

/** Un grupo es un paso del asistente: agrupa una o varias secciones de preguntas. */
export interface GroupDef {
  id: string;
  title: L10n;
  subtitle?: L10n;
  sections: SectionDef[];
}

export type CategoryId = "consulta" | "tax" | "registration";

export interface ServiceDef {
  id: string;
  /** ID del Sheet (APT-0x) cuando existe. */
  sheetId?: string;
  category: CategoryId;
  name: L10n;
  short: L10n;
  durationMin: number;
  /** Requiere que el cliente ya haya tenido un acercamiento con un gestor. */
  requiresPriorContact?: boolean;
  /** La cita queda "pendiente" hasta que un gestor la apruebe. */
  requiresApproval?: boolean;
  /** Bloque legal a mostrar antes de confirmar. */
  legal: "tax_terms" | "perjury" | "general";
  intro?: L10n;
  groups: GroupDef[];
  color: string;
}

export interface CategoryDef {
  id: CategoryId;
  name: L10n;
  description: L10n;
  icon: "chat" | "receipt" | "car";
}

const t = (es: string, en: string): L10n => ({ es, en });
const YES_NO: FieldOption[] = [
  { value: "yes", label: t("Sí", "Yes") },
  { value: "no", label: t("No", "No") },
];

/* ------------------------------------------------------------------ */
/* Campos reutilizables                                                 */
/* ------------------------------------------------------------------ */

/** Datos de contacto: se piden en todos los servicios (columnas propias en la BD). */
export const CONTACT_FIELDS: FieldDef[] = [
  { key: "first_name", type: "text", label: t("Nombre", "First name"), required: true },
  { key: "last_name", type: "text", label: t("Apellidos", "Last name"), required: true },
  {
    key: "email",
    type: "email",
    label: t("Correo electrónico", "Email"),
    help: t("Aquí recibirás la confirmación y los recordatorios.", "Your confirmation and reminders will be sent here."),
    required: true,
  },
  {
    key: "phone",
    type: "tel",
    label: t("Teléfono / WhatsApp", "Phone / WhatsApp"),
    placeholder: t("+1 (201) 555-0123", "+1 (201) 555-0123"),
    required: true,
    pattern: "^\\+?[0-9()\\-\\s.]{7,20}$",
    patternMessage: t("Escribe un teléfono válido.", "Enter a valid phone number."),
  },
];

const ADDRESS_SECTION: SectionDef = {
  id: "address",
  title: t("Dirección", "Address"),
  fields: [
    { key: "address_street", type: "text", label: t("Dirección", "Address"), help: t("Calle, número y apartamento.", "Street, number and apartment."), required: true, wide: true },
    { key: "city", type: "text", label: t("Ciudad", "City"), required: true },
    { key: "state", type: "us_state", label: t("Estado", "State"), required: true },
    {
      key: "zip_code",
      type: "text",
      label: t("Zip Code", "Zip Code"),
      required: true,
      pattern: "^\\d{5}(-\\d{4})?$",
      patternMessage: t("El Zip Code debe tener 5 dígitos.", "Zip Code must have 5 digits."),
    },
  ],
};

const SSN_PATTERN = "^\\d{3}-?\\d{2}-?\\d{4}$";
const SSN_MSG = t("Formato XXX-XX-XXXX.", "Format XXX-XX-XXXX.");

/* ------------------------------------------------------------------ */
/* Categorías                                                           */
/* ------------------------------------------------------------------ */

export const CATEGORIES: CategoryDef[] = [
  {
    id: "consulta",
    name: t("Consulta general", "General consultation"),
    description: t(
      "Cuéntanos qué necesitas: impuestos, compañías, notaría, traducciones y más.",
      "Tell us what you need: taxes, companies, notary, translations and more.",
    ),
    icon: "chat",
  },
  {
    id: "tax",
    name: t("Taxes", "Taxes"),
    description: t(
      "Declaración personal, de compañía o trámite de ITIN. Requiere un acercamiento previo con un gestor.",
      "Personal or business returns, or ITIN. Requires prior contact with one of our advisors.",
    ),
    icon: "receipt",
  },
  {
    id: "registration",
    name: t("Registration", "Registration"),
    description: t(
      "Registraciones de vehículos, renovaciones, citas DMV y creación de compañías.",
      "Vehicle registrations, renewals, DMV appointments and company formation.",
    ),
    icon: "car",
  },
];

/* ------------------------------------------------------------------ */
/* Servicios                                                            */
/* ------------------------------------------------------------------ */

const CONSULTA: ServiceDef = {
  id: "consulta",
  sheetId: "APT-01",
  category: "consulta",
  name: t("Consulta general", "General consultation"),
  short: t("Consulta", "Consultation"),
  durationMin: 30,
  legal: "general",
  color: "#7B6CF6",
  // PROVISIONAL: el Sheet tiene APT-01 pendiente de extraer.
  groups: [
    {
      id: "topic",
      title: t("Tu consulta", "Your consultation"),
      subtitle: t("Así preparamos la reunión contigo.", "This helps us prepare for the meeting."),
      sections: [
        {
          id: "consulta",
          title: t("Sobre la consulta", "About the consultation"),
          fields: [
            {
              key: "topic",
              type: "select",
              label: t("¿Sobre qué tema es tu consulta?", "What is your consultation about?"),
              required: true,
              options: [
                { value: "taxes", label: t("Impuestos personales o de compañía", "Personal or business taxes") },
                { value: "bookkeeping", label: t("Bookkeeping y planificación tributaria", "Bookkeeping and tax planning") },
                { value: "company", label: t("Creación de compañías (LLC, S-Corp)", "Company formation (LLC, S-Corp)") },
                { value: "compliance", label: t("Cumplimiento y registraciones", "Compliance and registrations") },
                { value: "vehicles", label: t("Vehículos y citas DMV", "Vehicles and DMV appointments") },
                { value: "usdot", label: t("USDOT y MC Number", "USDOT and MC Number") },
                { value: "itin", label: t("ITIN", "ITIN") },
                { value: "home_improvement", label: t("Licencia Home Improvement NJ", "NJ Home Improvement license") },
                { value: "notary", label: t("Notario público NJ", "NJ notary public") },
                { value: "wedding", label: t("Oficiante de bodas", "Wedding officiant") },
                { value: "audit", label: t("Auditorías Workers Comp / Liability", "Workers Comp / Liability audits") },
                { value: "translation", label: t("Traducción de documentos", "Document translation") },
                { value: "other", label: t("Otro", "Other") },
              ],
            },
            {
              key: "is_existing_client",
              type: "yesno",
              label: t("¿Ya eres cliente de AA Solutions?", "Are you already an AA Solutions client?"),
              required: true,
              options: YES_NO,
            },
            {
              key: "message",
              type: "textarea",
              label: t("Cuéntanos brevemente qué necesitas", "Briefly tell us what you need"),
              required: true,
              wide: true,
            },
            {
              key: "attachments",
              type: "file",
              label: t("Documentos de apoyo (opcional)", "Supporting documents (optional)"),
              help: t("Imágenes o PDF, máximo 10 MB cada uno.", "Images or PDF, up to 10 MB each."),
              wide: true,
            },
          ],
        },
      ],
    },
  ],
};

const TAX_PERSONAL: ServiceDef = {
  id: "tax_personal",
  sheetId: "APT-02 / APT-05",
  category: "tax",
  name: t("Taxes personales", "Personal taxes"),
  short: t("Tax personal", "Personal tax"),
  durationMin: 30,
  requiresPriorContact: true,
  legal: "tax_terms",
  color: "#EC5FA8",
  intro: t(
    "Es importante que sigas todos los pasos para asegurarte de que tu declaración sea precisa y esté completa.",
    "It is important that you follow all steps to ensure your tax return is accurate and complete.",
  ),
  groups: [
    {
      id: "taxpayer",
      title: t("Contribuyente", "Taxpayer"),
      subtitle: t("Tus datos personales y fiscales.", "Your personal and tax information."),
      sections: [
        {
          id: "filing",
          title: t("Declaración fiscal", "Tax filing"),
          fields: [
            {
              key: "tax_years",
              type: "checkbox_group",
              label: t("Años de impuestos que deseas declarar", "Tax years you wish to file"),
              required: true,
              options: [], // se llenan dinámicamente con taxYearOptions()
              wide: true,
            },
          ],
        },
        {
          id: "taxpayer",
          title: t("Datos del contribuyente", "Taxpayer information"),
          fields: [
            { key: "ssn_itin", type: "text", label: t("SSN / ITIN", "SSN / ITIN"), help: t("Se guarda cifrado.", "Stored encrypted."), required: true, sensitive: true, pattern: SSN_PATTERN, patternMessage: SSN_MSG, placeholder: t("XXX-XX-XXXX", "XXX-XX-XXXX") },
            { key: "date_of_birth", type: "date", label: t("Fecha de nacimiento", "Date of birth"), required: true },
            { key: "occupation", type: "text", label: t("Ocupación laboral", "Occupation"), required: true },
          ],
        },
        ADDRESS_SECTION,
      ],
    },
    {
      id: "personal",
      title: t("Situación personal", "Personal status"),
      subtitle: t("Estado civil, dependencia y cónyuge.", "Marital status, dependency and spouse."),
      sections: [
        {
          id: "status",
          title: t("Situación personal", "Personal status"),
          fields: [
            { key: "is_dependent", type: "yesno", label: t("¿Es usted dependiente?", "Are you a dependent?"), help: t("Alguien más lo declara como dependiente.", "Someone else claims you as a dependent."), required: true, options: YES_NO },
            { key: "is_disabled", type: "yesno", label: t("¿Es usted discapacitado?", "Are you disabled?"), required: true, options: YES_NO },
            {
              key: "marital_status",
              type: "select",
              label: t("Estado civil", "Marital status"),
              required: true,
              // PROVISIONAL: opciones estándar del IRS (el Sheet no trae las del desplegable).
              options: [
                { value: "single", label: t("Soltero/a", "Single") },
                { value: "married_joint", label: t("Casado/a, declaración conjunta", "Married filing jointly") },
                { value: "married_separate", label: t("Casado/a, declaración separada", "Married filing separately") },
                { value: "head_of_household", label: t("Cabeza de familia", "Head of household") },
                { value: "widow", label: t("Viudo/a calificado/a", "Qualifying surviving spouse") },
              ],
            },
          ],
        },
        {
          id: "spouse",
          title: t("Datos del cónyuge", "Spouse information"),
          intro: t("Solo si declara como casado/a.", "Only if filing as married."),
          fields: [
            { key: "spouse_name", type: "text", label: t("Nombre completo del esposo/a", "Spouse full name"), required: true, showIf: { field: "marital_status", in: ["married_joint", "married_separate"] } },
            { key: "spouse_ssn", type: "text", label: t("SSN / ITIN del esposo/a", "Spouse SSN / ITIN"), required: true, sensitive: true, pattern: SSN_PATTERN, patternMessage: SSN_MSG, placeholder: t("XXX-XX-XXXX", "XXX-XX-XXXX"), showIf: { field: "marital_status", in: ["married_joint", "married_separate"] } },
            { key: "spouse_dob", type: "date", label: t("Fecha de nacimiento del esposo/a", "Spouse date of birth"), showIf: { field: "marital_status", in: ["married_joint", "married_separate"] } },
            { key: "spouse_email", type: "email", label: t("Email del esposo/a", "Spouse email"), showIf: { field: "marital_status", in: ["married_joint", "married_separate"] } },
            { key: "spouse_phone", type: "tel", label: t("Celular del esposo/a", "Spouse cell phone"), showIf: { field: "marital_status", in: ["married_joint", "married_separate"] } },
            { key: "spouse_id_file", type: "file", label: t("Licencia o ID del esposo/a", "Spouse driver's license or ID"), help: t("Foto o PDF.", "Photo or PDF."), showIf: { field: "marital_status", in: ["married_joint", "married_separate"] } },
          ],
        },
      ],
    },
    {
      id: "refund",
      title: t("Reembolso e información adicional", "Refund and additional info"),
      sections: [
        {
          id: "refund",
          title: t("Reembolso", "Refund"),
          fields: [
            {
              key: "refund_method",
              type: "select",
              label: t("¿Cómo desea recibir el reembolso?", "How would you like to receive your refund?"),
              required: true,
              // PROVISIONAL
              options: [
                { value: "direct_deposit", label: t("Depósito directo a mi cuenta", "Direct deposit to my account") },
                { value: "check", label: t("Cheque por correo", "Paper check by mail") },
              ],
            },
            { key: "bank_routing_number", type: "text", label: t("Número de ruta", "Routing number"), required: true, sensitive: true, pattern: "^\\d{9}$", patternMessage: t("Debe tener 9 dígitos.", "Must have 9 digits."), showIf: { field: "refund_method", in: ["direct_deposit"] } },
            { key: "bank_account_number", type: "text", label: t("Número de cuenta", "Account number"), required: true, sensitive: true, pattern: "^\\d{4,17}$", patternMessage: t("Solo números (4 a 17 dígitos).", "Digits only (4 to 17)."), showIf: { field: "refund_method", in: ["direct_deposit"] } },
            {
              key: "bank_account_type",
              type: "select",
              label: t("Tipo de cuenta", "Account type"),
              required: true,
              showIf: { field: "refund_method", in: ["direct_deposit"] },
              // PROVISIONAL
              options: [
                { value: "checking", label: t("Corriente (Checking)", "Checking") },
                { value: "savings", label: t("Ahorros (Savings)", "Savings") },
              ],
            },
          ],
        },
        {
          id: "additional",
          title: t("Información adicional", "Additional information"),
          fields: [
            {
              key: "has_health_insurance",
              type: "select",
              label: t("¿Tiene seguro médico?", "Do you have health insurance?"),
              required: true,
              // PROVISIONAL
              options: [
                { value: "no", label: t("No", "No") },
                { value: "marketplace", label: t("Sí, del Marketplace (formulario 1095-A)", "Yes, Marketplace (Form 1095-A)") },
                { value: "employer", label: t("Sí, por mi empleador", "Yes, through my employer") },
                { value: "medicaid_medicare", label: t("Sí, Medicaid o Medicare", "Yes, Medicaid or Medicare") },
                { value: "other", label: t("Sí, otro", "Yes, other") },
              ],
            },
            { key: "is_homeowner", type: "yesno", label: t("¿Es dueño de su casa?", "Are you a homeowner?"), required: true, options: YES_NO },
            { key: "has_single_member_llc", type: "yesno", label: t("¿Tiene una compañía de un solo miembro (LLC)?", "Do you have a single-member company (LLC)?"), required: true, options: YES_NO },
            { key: "ip_pin", type: "text", label: t("IP PIN (si aplica)", "IP PIN (if applicable)"), help: t("PIN de protección de identidad del IRS, 6 dígitos.", "IRS Identity Protection PIN, 6 digits."), sensitive: true, pattern: "^\\d{6}$", patternMessage: t("Debe tener 6 dígitos.", "Must have 6 digits.") },
          ],
        },
      ],
    },
    {
      id: "documents",
      title: t("Documentos", "Documents"),
      subtitle: t("Se guardan en una carpeta privada de tu cita.", "Saved in a private folder for your appointment."),
      sections: [
        {
          id: "documents",
          title: t("Identificación y documentos", "ID and documents"),
          fields: [
            { key: "taxpayer_id_file", type: "file", label: t("Licencia o ID", "Driver's license or ID"), help: t("Foto o PDF de tu identificación oficial.", "Photo or PDF of your official ID."), required: true, wide: true },
            { key: "tax_documents", type: "file", label: t("Documentos fiscales (W-2, 1099, etc.)", "Tax documents (W-2, 1099, etc.)"), help: t("Puedes subirlos aquí o llevarlos a la cita.", "Upload them here or bring them to the appointment."), wide: true },
            { key: "dependents_documents", type: "file", label: t("Documentos de dependientes (acta de nacimiento, SSN, ID)", "Dependents' documents (birth certificate, SSN, ID)"), help: t("Solo si tiene dependientes.", "Only if you have dependents."), wide: true },
            {
              key: "sent_tax_docs",
              type: "yesno",
              label: t(
                "¿Nos enviaste o subiste todos tus documentos fiscales (W-2, 1099, etc.)?",
                "Have you sent or uploaded all your tax documents (W-2, 1099, etc.)?",
              ),
              required: true,
              options: YES_NO,
            },
          ],
        },
      ],
    },
  ],
};

const TAX_BUSINESS: ServiceDef = {
  id: "tax_business",
  sheetId: "APT-03 / APT-06",
  category: "tax",
  name: t("Taxes de compañía", "Business taxes"),
  short: t("Tax compañía", "Business tax"),
  durationMin: 60,
  requiresPriorContact: true,
  legal: "tax_terms",
  color: "#1A10E8",
  groups: [
    {
      id: "company",
      title: t("Tu compañía", "Your company"),
      sections: [
        {
          id: "company",
          title: t("Datos de la compañía", "Company details"),
          intro: t("Opcional: nos ayuda a preparar la cita.", "Optional: helps us prepare the appointment."),
          fields: [
            { key: "company_name", type: "text", label: t("Nombre de la compañía", "Company name") },
            {
              key: "company_type",
              type: "select",
              label: t("Tipo de compañía", "Company type"),
              options: [
                { value: "llc_single", label: t("LLC de un miembro", "Single-member LLC") },
                { value: "llc_multi", label: t("LLC de varios miembros", "Multi-member LLC") },
                { value: "s_corp", label: t("S-Corp", "S-Corp") },
                { value: "c_corp", label: t("C-Corp", "C-Corp") },
                { value: "partnership", label: t("Sociedad (Partnership)", "Partnership") },
                { value: "unknown", label: t("No estoy seguro/a", "Not sure") },
              ],
            },
            { key: "company_documents", type: "file", label: t("Documentos de la compañía (opcional)", "Company documents (optional)"), wide: true },
          ],
        },
      ],
    },
  ],
};

const ITIN: ServiceDef = {
  id: "itin",
  sheetId: "APT-04",
  category: "tax",
  name: t("Aplicación / renovación ITIN", "ITIN application / renewal"),
  short: t("ITIN", "ITIN"),
  durationMin: 30,
  requiresPriorContact: true,
  legal: "perjury",
  color: "#14B8A6",
  intro: t(
    "Por favor completa toda la información requerida. Si tienes dependientes solicitando o renovando ITIN, deberás completar un formulario por cada uno.",
    "Please complete all required information. If you have dependents applying for or renewing an ITIN, you must complete one form per dependent.",
  ),
  groups: [
    {
      id: "application",
      title: t("Solicitud y datos personales", "Application and personal info"),
      sections: [
        {
          id: "itin",
          title: t("Solicitud ITIN", "ITIN application"),
          fields: [
            {
              key: "itin_application_type",
              type: "select",
              label: t("Tipo de aplicación", "Application type"),
              required: true,
              options: [
                { value: "new", label: t("Nuevo ITIN", "New ITIN") },
                { value: "renewal", label: t("Renovación ITIN", "ITIN renewal") },
              ],
            },
            { key: "requires_itin_for_dependents", type: "yesno", label: t("¿Requiere ITIN para dependientes?", "Do you require an ITIN for dependents?"), options: YES_NO },
          ],
        },
        {
          id: "personal",
          title: t("Datos personales", "Personal information"),
          fields: [
            { key: "date_of_birth", type: "date", label: t("Fecha de nacimiento", "Date of birth"), required: true },
            { key: "country_of_birth", type: "country", label: t("País de nacimiento", "Country of birth"), required: true },
            { key: "city_of_birth", type: "text", label: t("Ciudad de nacimiento", "City of birth"), required: true },
            { key: "occupation", type: "text", label: t("Ocupación", "Occupation"), required: true },
            { key: "us_entry_date", type: "date", label: t("Fecha de entrada al país", "Date of entry into the U.S."), required: true },
          ],
        },
        ADDRESS_SECTION,
      ],
    },
    {
      id: "docs_income",
      title: t("Documentos e ingresos", "Documents and income"),
      sections: [
        {
          id: "documents",
          title: t("Documentación", "Documentation"),
          fields: [
            {
              key: "submitted_documents",
              type: "checkbox_group",
              label: t("Marque los documentos que envía", "Check the documents you are submitting"),
              required: true,
              options: [
                { value: "passport", label: t("Pasaporte", "Passport") },
                { value: "license", label: t("Licencia", "Driver's license") },
                { value: "other", label: t("Otros", "Other") },
              ],
            },
            { key: "id_document_file", type: "file", label: t("Documento / ID", "Document / ID"), help: t("Foto o PDF.", "Photo or PDF."), required: true, wide: true },
          ],
        },
        {
          id: "income",
          title: t("Información de ingresos", "Income information"),
          fields: [
            {
              key: "income_types",
              type: "checkbox_group",
              label: t("Marque su tipo de ingreso", "Check your type of income"),
              required: true,
              options: [
                { value: "cash", label: t("Efectivo", "Cash") },
                { value: "w2", label: t("Forma W-2", "Form W-2") },
                { value: "1099", label: t("Forma 1099", "Form 1099") },
              ],
            },
            { key: "cash_annual_amount", type: "number", label: t("Si marcó efectivo, valor anual (USD)", "If you selected cash, annual amount (USD)"), required: true, showIf: { field: "income_types", in: ["cash"] } },
          ],
        },
      ],
    },
  ],
};

/* PROVISIONAL: "Registration" no está en el Sheet; campos propuestos hasta que AA Solutions los confirme. */
const REG_VEHICLE: ServiceDef = {
  id: "reg_vehicle",
  category: "registration",
  name: t("Vehículos y DMV", "Vehicles and DMV"),
  short: t("Vehículos", "Vehicles"),
  durationMin: 30,
  legal: "general",
  color: "#F59E0B",
  groups: [
    {
      id: "vehicle",
      title: t("Tu trámite", "Your request"),
      sections: [
        {
          id: "vehicle",
          title: t("Trámite de vehículo", "Vehicle request"),
          fields: [
            {
              key: "procedure",
              type: "select",
              label: t("¿Qué trámite necesitas?", "Which service do you need?"),
              required: true,
              options: [
                { value: "registration", label: t("Registración express", "Express registration") },
                { value: "renewal", label: t("Renovación de registración", "Registration renewal") },
                { value: "title", label: t("Título / transferencia", "Title / transfer") },
                { value: "plates", label: t("Placas", "Plates") },
                { value: "dmv_appointment", label: t("Gestión de cita en el DMV", "DMV appointment scheduling") },
                { value: "usdot_mc", label: t("USDOT y MC Number", "USDOT and MC Number") },
                { value: "other", label: t("Otro", "Other") },
              ],
            },
            { key: "vehicle_state", type: "us_state", label: t("Estado del trámite", "State"), required: true },
            { key: "vehicle_info", type: "text", label: t("Vehículo (año, marca, modelo)", "Vehicle (year, make, model)") },
            { key: "vin", type: "text", label: t("VIN (si lo tienes)", "VIN (if available)"), pattern: "^[A-HJ-NPR-Za-hj-npr-z0-9]{11,17}$", patternMessage: t("El VIN tiene 17 caracteres.", "VIN has 17 characters.") },
            { key: "notes", type: "textarea", label: t("Detalles adicionales", "Additional details"), wide: true },
            { key: "vehicle_documents", type: "file", label: t("Documentos (título, ID, seguro)", "Documents (title, ID, insurance)"), wide: true },
          ],
        },
      ],
    },
  ],
};

const REG_COMPANY: ServiceDef = {
  id: "reg_company",
  category: "registration",
  name: t("Creación y registro de compañías", "Company formation and registration"),
  short: t("Compañías", "Companies"),
  durationMin: 30,
  legal: "general",
  color: "#0EA5E9",
  groups: [
    {
      id: "company",
      title: t("Tu compañía", "Your company"),
      sections: [
        {
          id: "company",
          title: t("Datos del registro", "Registration details"),
          fields: [
            {
              key: "procedure",
              type: "select",
              label: t("¿Qué trámite necesitas?", "Which service do you need?"),
              required: true,
              options: [
                { value: "new_company", label: t("Crear una compañía nueva", "Form a new company") },
                { value: "annual_report", label: t("Reporte anual / cumplimiento", "Annual report / compliance") },
                { value: "changes", label: t("Cambio de dirección, miembros o estructura", "Change of address, members or structure") },
                { value: "home_improvement", label: t("Licencia Home Improvement NJ", "NJ Home Improvement license") },
                { value: "other", label: t("Otro", "Other") },
              ],
            },
            {
              key: "company_type",
              type: "select",
              label: t("Tipo de compañía", "Company type"),
              options: [
                { value: "llc", label: t("LLC", "LLC") },
                { value: "s_corp", label: t("S-Corp", "S-Corp") },
                { value: "corp", label: t("Corporación", "Corporation") },
                { value: "partnership", label: t("Sociedad (Partnership)", "Partnership") },
                { value: "unknown", label: t("No estoy seguro/a", "Not sure") },
              ],
            },
            { key: "company_name", type: "text", label: t("Nombre de la compañía (o propuesto)", "Company name (or proposed)") },
            { key: "company_state", type: "us_state", label: t("Estado", "State"), required: true },
            { key: "members_count", type: "number", label: t("Número de socios/miembros", "Number of members") },
            { key: "notes", type: "textarea", label: t("Detalles adicionales", "Additional details"), wide: true },
          ],
        },
      ],
    },
  ],
};

export const SERVICES: ServiceDef[] = [CONSULTA, TAX_PERSONAL, TAX_BUSINESS, ITIN, REG_VEHICLE, REG_COMPANY];

export function getService(id: string): ServiceDef | undefined {
  const s = SERVICES.find((x) => x.id === id);
  if (!s) return undefined;
  if (s.id === "tax_personal") return withTaxYears(s);
  return s;
}

export function servicesByCategory(category: CategoryId): ServiceDef[] {
  return SERVICES.filter((s) => s.category === category).map((s) => getService(s.id)!);
}

/** Los años fiscales se calculan solos: los últimos 5 años terminados. */
export function taxYearOptions(now = new Date()): FieldOption[] {
  const last = now.getFullYear() - 1;
  return Array.from({ length: 5 }, (_, i) => {
    const y = String(last - i);
    return { value: y, label: { es: y, en: y } };
  });
}

function withTaxYears(s: ServiceDef): ServiceDef {
  const years = taxYearOptions();
  return {
    ...s,
    groups: s.groups.map((g) => ({
      ...g,
      sections: g.sections.map((sec) => ({
        ...sec,
        fields: sec.fields.map((f) => (f.key === "tax_years" ? { ...f, options: years } : f)),
      })),
    })),
  };
}

export function allFields(s: ServiceDef): FieldDef[] {
  return s.groups.flatMap((g) => g.sections.flatMap((sec) => sec.fields));
}

export function isVisible(field: FieldDef, values: Record<string, unknown>): boolean {
  if (!field.showIf) return true;
  const v = values[field.showIf.field];
  if (Array.isArray(v)) return v.some((x) => field.showIf!.in.includes(String(x)));
  return v != null && field.showIf.in.includes(String(v));
}

export function optionLabel(field: FieldDef, value: string, locale: Locale): string {
  const o = field.options?.find((x) => x.value === value);
  return o ? o.label[locale] : value;
}

/* ------------------------------------------------------------------ */
/* Textos legales                                                       */
/* ------------------------------------------------------------------ */

export const TAX_TERMS: { title: L10n; clauses: { title: L10n; body: L10n }[]; accept: L10n } = {
  title: t("Términos y Condiciones para Agendar una Cita de Impuestos", "Terms and Conditions for Scheduling a Tax Appointment"),
  clauses: [
    {
      title: t("Agendamiento de cita", "Appointment scheduling"),
      body: t(
        "Al agendar una cita para la preparación de impuestos, el cliente acepta que se le brindará asistencia de acuerdo con la disponibilidad y horarios establecidos por nuestra oficina. Las citas se agendan en línea o por teléfono. Se requiere confirmación de la cita antes de la fecha establecida.",
        "By scheduling a tax preparation appointment, the client agrees that assistance will be provided according to the availability and hours established by our office. Appointments are scheduled online or by phone. Appointment confirmation is required prior to the scheduled date.",
      ),
    },
    {
      title: t("Información necesaria", "Required information"),
      body: t(
        "El cliente debe proporcionar la información necesaria y los documentos requeridos para preparar la declaración de impuestos. Estos pueden incluir formularios W-2, 1099, recibos de gastos deducibles, identificaciones personales, entre otros. En caso de no presentar la documentación completa o si los documentos son incorrectos, el servicio de preparación de impuestos podría ser pospuesto o no realizarse.",
        "The client must provide the necessary information and required documents to prepare the tax return. These may include W-2 forms, 1099 forms, deductible expense receipts, personal identifications, among others. Failure to submit complete documentation or submission of incorrect documents may result in postponing or not performing the tax preparation service.",
      ),
    },
    {
      title: t("Tarifas y pagos", "Fees and payments"),
      body: t(
        "Las tarifas por la preparación de impuestos serán discutidas antes de la cita, basadas en la complejidad de tu declaración. Los pagos deben realizarse en su totalidad antes de finalizar el proceso de preparación de impuestos. Aceptamos pagos en efectivo, tarjeta de crédito/débito y otros métodos electrónicos.",
        "Tax preparation fees will be discussed prior to the appointment based on the complexity of your return. Payments must be made in full before completing the tax preparation process. We accept cash, credit/debit cards, and other electronic payment methods.",
      ),
    },
    {
      title: t("Responsabilidad del cliente", "Client responsibility"),
      body: t(
        "El cliente es responsable de la veracidad de la información proporcionada. Cualquier error o discrepancia en la declaración, debido a información incorrecta o incompleta suministrada por el cliente, es responsabilidad del mismo. El cliente entiende que los servicios prestados son solo para la preparación de impuestos y que no proporcionamos asesoramiento legal, a menos que se haya acordado explícitamente.",
        "The client is responsible for the accuracy of the information provided. Any error or discrepancy in the return due to incorrect or incomplete information supplied by the client is the client's responsibility. The client understands that the services provided are solely for tax preparation and that we do not provide legal advice unless explicitly agreed upon.",
      ),
    },
    {
      title: t("Confidencialidad", "Confidentiality"),
      body: t(
        "Toda la información proporcionada por el cliente será tratada de manera confidencial y utilizada únicamente para los fines de la preparación de impuestos. Cumplimos con todas las normativas de privacidad y protección de datos.",
        "All information provided by the client will be treated confidentially and used solely for tax preparation purposes. We comply with all privacy and data protection regulations.",
      ),
    },
    {
      title: t("Reembolso y auditorías", "Refunds and audits"),
      body: t(
        "El servicio de preparación de impuestos incluye la verificación básica de la declaración. Sin embargo, si surge una auditoría por parte de las autoridades fiscales, el cliente será responsable de manejarla, aunque podemos ofrecer asistencia adicional si es necesario. Los reembolsos de impuestos serán procesados directamente por las autoridades fiscales, y no somos responsables de los plazos en los que dichos reembolsos sean entregados.",
        "The tax preparation service includes basic verification of the return. However, if an audit arises from tax authorities, the client will be responsible for handling it, although we may offer additional assistance if necessary. Tax refunds are processed directly by tax authorities, and we are not responsible for the timeframes in which such refunds are delivered.",
      ),
    },
    {
      title: t("Modificación de términos", "Modification of terms"),
      body: t(
        "Nos reservamos el derecho de modificar estos términos y condiciones en cualquier momento, notificando a los clientes sobre cualquier cambio relevante antes de la cita programada.",
        "We reserve the right to modify these terms and conditions at any time, notifying clients of any relevant changes prior to the scheduled appointment.",
      ),
    },
    {
      title: t("Aceptación de términos", "Acceptance of terms"),
      body: t(
        "Al agendar una cita, el cliente acepta estos términos y condiciones.",
        "By scheduling an appointment, the client accepts these terms and conditions.",
      ),
    },
  ],
  accept: t("He leído y acepto las condiciones que anteceden.", "I have read and accept the foregoing terms and conditions."),
};

export const PERJURY_TEXT = t(
  "Declaro, bajo pena de perjurio, que la información proporcionada en este documento es verdadera y correcta.",
  "I declare, under penalty of perjury, that the information provided in this document is true and correct.",
);

export const GENERAL_CONSENT = t(
  "Acepto que AA Solutions Services use mis datos únicamente para gestionar esta cita y contactarme sobre ella.",
  "I agree that AA Solutions Services may use my data only to manage this appointment and contact me about it.",
);

export const PRIOR_CONTACT_TEXT = t(
  "Para agendar una cita de Taxes debes haber tenido antes un acercamiento con uno de nuestros gestores.",
  "To book a Taxes appointment you must have already been in contact with one of our advisors.",
);

export const US_STATES: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"],
  ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"],
  ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"],
  ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"],
  ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["PR", "Puerto Rico"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];
