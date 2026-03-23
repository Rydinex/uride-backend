// VALIDATION FOR DRIVER ONBOARDING

const REQUIRED_STANDARD_DOCS = [
  "drivers_license",
  "registration",
  "insurance",
  "background_check",
];

const REQUIRED_PRO_DOCS = [
  "drivers_license",
  "registration",
  "commercial_insurance",
  "chauffeur_license",
  "background_check",
];

function validateDriverDocuments(driverType, docs) {
  const required = driverType === "professional"
    ? REQUIRED_PRO_DOCS
    : REQUIRED_STANDARD_DOCS;

  for (const doc of required) {
    const found = docs.some(
      d => d.docType === doc && d.status === "approved"
    );

    if (!found) {
      return `Missing or unapproved required document: ${doc}`;
    }
  }

  return null;
}

function validateDriverTypeAndCategory(driverType, rideCategory) {
  const standardAllowed = [
    "rydine_regular",
    "rydine_comfort",
    "rydine_xl",
    "rydine_green",
  ];

  const professionalAllowed = ["black_car", "black_suv"];

  if (driverType === "standard" && !standardAllowed.includes(rideCategory)) {
    return "Standard drivers cannot register Black Car or Black SUV vehicles.";
  }

  if (driverType === "professional" && !professionalAllowed.includes(rideCategory)) {
    return "Professional drivers must select Black Car or Black SUV.";
  }

  return null;
}

function validateVehicleYear(year) {
  if (year < 2013) {
    return "Vehicle must be model year 2013 or newer.";
  }
  return null;
}

module.exports = {
  validateDriverDocuments,
  validateDriverTypeAndCategory,
  validateVehicleYear,
};