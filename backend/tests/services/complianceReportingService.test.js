const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateDriverChicagoRequirements } = require('../../services/complianceReportingService');

function buildBaseDriver(overrides = {}) {
  return {
    _id: '65f13b9f1f1f1f1f1f1f1f1f',
    name: 'Test Driver',
    email: 'driver@example.com',
    status: 'approved',
    operatingStates: ['IL'],
    docs: [
      {
        docType: 'background_check',
        status: 'approved',
        uploadedAt: new Date('2026-01-10T10:00:00.000Z'),
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      },
      {
        docType: 'license',
        status: 'approved',
        uploadedAt: new Date('2026-01-10T10:00:00.000Z'),
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      },
      {
        docType: 'commercial_insurance',
        status: 'approved',
        uploadedAt: new Date('2026-01-10T10:00:00.000Z'),
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      },
      {
        docType: 'insurance',
        status: 'approved',
        uploadedAt: new Date('2026-01-11T10:00:00.000Z'),
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      },
      {
        docType: 'vehicle_registration',
        status: 'approved',
        uploadedAt: new Date('2026-01-11T10:00:00.000Z'),
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      },
      {
        docType: 'profile_picture',
        status: 'approved',
        uploadedAt: new Date('2026-01-11T10:00:00.000Z'),
        expiresAt: null,
      },
      {
        docType: 'hard_card',
        status: 'approved',
        uploadedAt: new Date('2026-01-11T10:00:00.000Z'),
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      },
      {
        docType: 'vehicle_inspection',
        status: 'approved',
        uploadedAt: new Date('2026-01-12T10:00:00.000Z'),
        expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    ],
    vehicleInspection: {
      status: 'approved',
      uploadedAt: new Date('2026-01-12T10:00:00.000Z'),
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      inspectionCenter: 'City Inspector',
    },
    chauffeurLicense: {
      status: 'verified',
      issuingState: 'IL',
      verifiedAt: new Date('2026-01-05T00:00:00.000Z'),
      expiresAt: new Date('2026-12-01T00:00:00.000Z'),
    },
    ...overrides,
  };
}

test('evaluateDriverChicagoRequirements marks fully compliant approved driver', () => {
  const profile = evaluateDriverChicagoRequirements(
    buildBaseDriver(),
    { now: new Date('2026-03-01T00:00:00.000Z') }
  );

  assert.equal(profile.isCompliant, true);
  assert.deepEqual(profile.missingRequirements, []);
  assert.equal(profile.requirements.backgroundCheck.isCompliant, true);
  assert.equal(profile.requirements.insuranceVerification.isCompliant, true);
  assert.equal(profile.requirements.vehicleInspection.isCompliant, true);
  assert.equal(profile.requirements.stateDriverLicense.isCompliant, true);
  assert.equal(profile.requirements.commercialInsurance.isCompliant, true);
  assert.equal(profile.requirements.vehicleRegistration.isCompliant, true);
  assert.equal(profile.requirements.profilePicture.isCompliant, true);
  assert.equal(profile.requirements.hardCard.isCompliant, true);
  assert.equal(profile.requirements.chauffeurLicense.isCompliant, true);
});

test('evaluateDriverChicagoRequirements flags missing background check', () => {
  const profile = evaluateDriverChicagoRequirements(
    buildBaseDriver({
      docs: [
        {
          docType: 'insurance',
          status: 'approved',
          uploadedAt: new Date('2026-01-11T10:00:00.000Z'),
          expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        },
      ],
    }),
    { now: new Date('2026-03-01T00:00:00.000Z') }
  );

  assert.equal(profile.isCompliant, false);
  assert.ok(profile.missingRequirements.includes('backgroundCheck'));
  assert.equal(profile.requirements.backgroundCheck.status, 'missing');
});

test('evaluateDriverChicagoRequirements requires chauffeur license for Illinois', () => {
  const profile = evaluateDriverChicagoRequirements(
    buildBaseDriver({
      chauffeurLicense: {
        status: 'pending',
        issuingState: 'IL',
        verifiedAt: null,
        expiresAt: new Date('2026-12-01T00:00:00.000Z'),
      },
    }),
    { now: new Date('2026-03-01T00:00:00.000Z') }
  );

  assert.equal(profile.isCompliant, false);
  assert.ok(profile.missingRequirements.includes('chauffeurLicense'));
  assert.equal(profile.requirements.chauffeurLicense.required, true);
  assert.equal(profile.requirements.chauffeurLicense.status, 'pending');
});

test('evaluateDriverChicagoRequirements requires chauffeur hard card for Illinois premium service', () => {
  const profile = evaluateDriverChicagoRequirements(
    buildBaseDriver({
      docs: buildBaseDriver().docs.filter(doc => doc.docType !== 'hard_card'),
    }),
    { now: new Date('2026-03-01T00:00:00.000Z') }
  );

  assert.equal(profile.isCompliant, false);
  assert.ok(profile.missingRequirements.includes('hardCard'));
  assert.equal(profile.requirements.hardCard.required, true);
  assert.equal(profile.requirements.hardCard.status, 'missing');
});
