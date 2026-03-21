const SUPPORTED_EVENT_CODES = ['UNITED_CENTER', 'WRIGLEY_FIELD', 'SOLDIER_FIELD'];

const AIRPORT_GEOFENCES = {
  ORD: {
    code: 'ORD',
    name: "O'Hare International Airport",
    queueStrict: true,
    pickupInstructions: {
      regular: [
        'Proceed to ORD rideshare regular pickup zones only.',
        'Stay in the designated TNP lane and avoid terminal curbside pickups.',
        'Confirm terminal and door number before driver arrival.',
      ],
      black_car: [
        'Use the ORD premium/black car pickup zones for professional service pickups.',
        'Follow airport marshal directions before approaching the pickup lane.',
        'Coordinate exact meeting point using pickup zone code.',
      ],
    },
    polygon: [
      { latitude: 41.9928, longitude: -87.9515 },
      { latitude: 41.9928, longitude: -87.8668 },
      { latitude: 41.9498, longitude: -87.8668 },
      { latitude: 41.9498, longitude: -87.9515 },
    ],
    tnpLots: {
      regular: {
        code: 'ORD_REGULAR_LOT',
        name: 'ORD TNP Regular Lot',
        polygon: [
          { latitude: 41.9862, longitude: -87.9205 },
          { latitude: 41.9862, longitude: -87.9058 },
          { latitude: 41.9776, longitude: -87.9058 },
          { latitude: 41.9776, longitude: -87.9205 },
        ],
      },
      black_car: {
        code: 'ORD_BLACK_CAR_LOT',
        name: 'ORD TNP Black Car Lot',
        polygon: [
          { latitude: 41.9824, longitude: -87.9335 },
          { latitude: 41.9824, longitude: -87.9228 },
          { latitude: 41.9748, longitude: -87.9228 },
          { latitude: 41.9748, longitude: -87.9335 },
        ],
      },
    },
    pickupZones: [
      {
        code: 'ORD_ZONE_T2',
        name: 'ORD Pickup Zone Terminal 2',
        laneType: 'regular',
        polygon: [
          { latitude: 41.9805, longitude: -87.9086 },
          { latitude: 41.9805, longitude: -87.9048 },
          { latitude: 41.9778, longitude: -87.9048 },
          { latitude: 41.9778, longitude: -87.9086 },
        ],
      },
      {
        code: 'ORD_ZONE_T5_PREMIUM',
        name: 'ORD Premium Pickup Zone Terminal 5',
        laneType: 'black_car',
        polygon: [
          { latitude: 41.9774, longitude: -87.8949 },
          { latitude: 41.9774, longitude: -87.8918 },
          { latitude: 41.9748, longitude: -87.8918 },
          { latitude: 41.9748, longitude: -87.8949 },
        ],
      },
    ],
  },
  MDW: {
    code: 'MDW',
    name: 'Chicago Midway International Airport',
    queueStrict: true,
    pickupInstructions: {
      regular: [
        'Use Midway designated rideshare pickup lanes only.',
        'Do not accept curbside pickups outside signed TNP zones.',
        'Coordinate with rider using the posted pickup sign number.',
      ],
      black_car: [
        'Use Midway black car staging and premium pickup lane assignments.',
        'Wait for lane dispatch before entering terminal pickup approach.',
        'Maintain professional standby in the premium lane queue.',
      ],
    },
    polygon: [
      { latitude: 41.8066, longitude: -87.7874 },
      { latitude: 41.8066, longitude: -87.7279 },
      { latitude: 41.7696, longitude: -87.7279 },
      { latitude: 41.7696, longitude: -87.7874 },
    ],
    tnpLots: {
      regular: {
        code: 'MDW_REGULAR_LOT',
        name: 'MDW TNP Regular Lot',
        polygon: [
          { latitude: 41.7941, longitude: -87.7638 },
          { latitude: 41.7941, longitude: -87.7548 },
          { latitude: 41.7872, longitude: -87.7548 },
          { latitude: 41.7872, longitude: -87.7638 },
        ],
      },
      black_car: {
        code: 'MDW_BLACK_CAR_LOT',
        name: 'MDW TNP Black Car Lot',
        polygon: [
          { latitude: 41.7912, longitude: -87.7714 },
          { latitude: 41.7912, longitude: -87.7636 },
          { latitude: 41.7849, longitude: -87.7636 },
          { latitude: 41.7849, longitude: -87.7714 },
        ],
      },
    },
    pickupZones: [
      {
        code: 'MDW_ZONE_A',
        name: 'MDW Pickup Lane A',
        laneType: 'regular',
        polygon: [
          { latitude: 41.7895, longitude: -87.7458 },
          { latitude: 41.7895, longitude: -87.7426 },
          { latitude: 41.7868, longitude: -87.7426 },
          { latitude: 41.7868, longitude: -87.7458 },
        ],
      },
      {
        code: 'MDW_PREMIUM_LANE',
        name: 'MDW Premium Pickup Lane',
        laneType: 'black_car',
        polygon: [
          { latitude: 41.7877, longitude: -87.7409 },
          { latitude: 41.7877, longitude: -87.7383 },
          { latitude: 41.7851, longitude: -87.7383 },
          { latitude: 41.7851, longitude: -87.7409 },
        ],
      },
    ],
  },
};

const EVENT_GEOFENCES = {
  UNITED_CENTER: {
    code: 'UNITED_CENTER',
    name: 'United Center',
    queueWindow: {
      startHourLocal: 15,
      endHourLocal: 23,
      activeDays: [4, 5, 6, 0],
    },
    venuePolygon: [
      { latitude: 41.8836, longitude: -87.6812 },
      { latitude: 41.8836, longitude: -87.6695 },
      { latitude: 41.8766, longitude: -87.6695 },
      { latitude: 41.8766, longitude: -87.6812 },
    ],
    stagingAreas: {
      regular: {
        code: 'UC_STAGE_REGULAR',
        name: 'United Center Regular Staging',
        polygon: [
          { latitude: 41.8859, longitude: -87.6788 },
          { latitude: 41.8859, longitude: -87.6728 },
          { latitude: 41.8838, longitude: -87.6728 },
          { latitude: 41.8838, longitude: -87.6788 },
        ],
      },
      black_car: {
        code: 'UC_STAGE_BLACK_CAR',
        name: 'United Center Black Car Staging',
        polygon: [
          { latitude: 41.8827, longitude: -87.6814 },
          { latitude: 41.8827, longitude: -87.6768 },
          { latitude: 41.8807, longitude: -87.6768 },
          { latitude: 41.8807, longitude: -87.6814 },
        ],
      },
    },
    pickupLanes: [
      {
        code: 'UC_PICKUP_LANE_1',
        name: 'United Center Pickup Lane 1',
        laneType: 'regular',
        polygon: [
          { latitude: 41.8817, longitude: -87.6749 },
          { latitude: 41.8817, longitude: -87.6712 },
          { latitude: 41.8798, longitude: -87.6712 },
          { latitude: 41.8798, longitude: -87.6749 },
        ],
      },
      {
        code: 'UC_PICKUP_PREMIUM',
        name: 'United Center Premium Pickup',
        laneType: 'black_car',
        polygon: [
          { latitude: 41.8808, longitude: -87.6778 },
          { latitude: 41.8808, longitude: -87.6749 },
          { latitude: 41.8791, longitude: -87.6749 },
          { latitude: 41.8791, longitude: -87.6778 },
        ],
      },
    ],
    riderInstructions: [
      'Use event pickup lane signage and share lane code with your driver.',
      'Expect short hold times around crowd release windows.',
      'Follow venue staff direction to stay within designated pickup lanes.',
    ],
  },
  WRIGLEY_FIELD: {
    code: 'WRIGLEY_FIELD',
    name: 'Wrigley Field',
    queueWindow: {
      startHourLocal: 14,
      endHourLocal: 23,
      activeDays: [4, 5, 6, 0],
    },
    venuePolygon: [
      { latitude: 41.9517, longitude: -87.6589 },
      { latitude: 41.9517, longitude: -87.6498 },
      { latitude: 41.9454, longitude: -87.6498 },
      { latitude: 41.9454, longitude: -87.6589 },
    ],
    stagingAreas: {
      regular: {
        code: 'WRIGLEY_STAGE_REGULAR',
        name: 'Wrigley Regular Staging',
        polygon: [
          { latitude: 41.9526, longitude: -87.6594 },
          { latitude: 41.9526, longitude: -87.6542 },
          { latitude: 41.9508, longitude: -87.6542 },
          { latitude: 41.9508, longitude: -87.6594 },
        ],
      },
      black_car: {
        code: 'WRIGLEY_STAGE_BLACK_CAR',
        name: 'Wrigley Black Car Staging',
        polygon: [
          { latitude: 41.9471, longitude: -87.6582 },
          { latitude: 41.9471, longitude: -87.6536 },
          { latitude: 41.9454, longitude: -87.6536 },
          { latitude: 41.9454, longitude: -87.6582 },
        ],
      },
    },
    pickupLanes: [
      {
        code: 'WRIGLEY_PICKUP_NORTH',
        name: 'Wrigley Pickup North Lane',
        laneType: 'regular',
        polygon: [
          { latitude: 41.9495, longitude: -87.6559 },
          { latitude: 41.9495, longitude: -87.6521 },
          { latitude: 41.9479, longitude: -87.6521 },
          { latitude: 41.9479, longitude: -87.6559 },
        ],
      },
      {
        code: 'WRIGLEY_PICKUP_PREMIUM',
        name: 'Wrigley Premium Pickup',
        laneType: 'black_car',
        polygon: [
          { latitude: 41.9484, longitude: -87.6576 },
          { latitude: 41.9484, longitude: -87.6552 },
          { latitude: 41.9468, longitude: -87.6552 },
          { latitude: 41.9468, longitude: -87.6576 },
        ],
      },
    ],
    riderInstructions: [
      'Move to your assigned pickup lane after leaving the ballpark.',
      'Heavy pedestrian traffic is expected for 30 to 45 minutes post-game.',
      'Confirm lane code before requesting support for rerouting.',
    ],
  },
  SOLDIER_FIELD: {
    code: 'SOLDIER_FIELD',
    name: 'Soldier Field',
    queueWindow: {
      startHourLocal: 14,
      endHourLocal: 23,
      activeDays: [4, 5, 6, 0],
    },
    venuePolygon: [
      { latitude: 41.8656, longitude: -87.6229 },
      { latitude: 41.8656, longitude: -87.6098 },
      { latitude: 41.8578, longitude: -87.6098 },
      { latitude: 41.8578, longitude: -87.6229 },
    ],
    stagingAreas: {
      regular: {
        code: 'SF_STAGE_REGULAR',
        name: 'Soldier Field Regular Staging',
        polygon: [
          { latitude: 41.8672, longitude: -87.6209 },
          { latitude: 41.8672, longitude: -87.6158 },
          { latitude: 41.8652, longitude: -87.6158 },
          { latitude: 41.8652, longitude: -87.6209 },
        ],
      },
      black_car: {
        code: 'SF_STAGE_BLACK_CAR',
        name: 'Soldier Field Black Car Staging',
        polygon: [
          { latitude: 41.8618, longitude: -87.6224 },
          { latitude: 41.8618, longitude: -87.6178 },
          { latitude: 41.8599, longitude: -87.6178 },
          { latitude: 41.8599, longitude: -87.6224 },
        ],
      },
    },
    pickupLanes: [
      {
        code: 'SF_PICKUP_LANE_EAST',
        name: 'Soldier Field Pickup East Lane',
        laneType: 'regular',
        polygon: [
          { latitude: 41.8626, longitude: -87.6148 },
          { latitude: 41.8626, longitude: -87.6121 },
          { latitude: 41.8608, longitude: -87.6121 },
          { latitude: 41.8608, longitude: -87.6148 },
        ],
      },
      {
        code: 'SF_PICKUP_PREMIUM',
        name: 'Soldier Field Premium Pickup',
        laneType: 'black_car',
        polygon: [
          { latitude: 41.8612, longitude: -87.6166 },
          { latitude: 41.8612, longitude: -87.6141 },
          { latitude: 41.8595, longitude: -87.6141 },
          { latitude: 41.8595, longitude: -87.6166 },
        ],
      },
    ],
    riderInstructions: [
      'Use signed event pickup lanes and avoid non-designated curb zones.',
      'Expect lane marshaling and staggered release after major events.',
      'Stay in your assigned pickup lane until your driver arrives.',
    ],
  },
};

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePoint(point) {
  if (!point || typeof point !== 'object') {
    return null;
  }

  const latitude = toFiniteNumber(point.latitude);
  const longitude = toFiniteNumber(point.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
}

function normalizeRideCategory(rideCategory) {
  const normalized = String(rideCategory || '')
    .trim()
    .toLowerCase();

  return ['black_car', 'black_suv', 'suv', 'rydinex_comfort', 'rydinex_xl', 'comfort', 'xl'].includes(normalized)
    ? 'black_car'
    : 'regular';
}

function isPointInsidePolygon(point, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersects =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi || Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function getChicagoDateParts(referenceDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(referenceDate);
  const weekday = String(parts.find(part => part.type === 'weekday')?.value || '').toLowerCase();
  const hour = Number(parts.find(part => part.type === 'hour')?.value || '0');

  const weekdayMap = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };

  return {
    hour,
    day: weekdayMap[weekday] ?? 0,
  };
}

function findZoneByPoint(point, zones = []) {
  const normalizedPoint = normalizePoint(point);
  if (!normalizedPoint) {
    return null;
  }

  for (const zone of zones) {
    if (isPointInsidePolygon(normalizedPoint, zone.polygon)) {
      return zone;
    }
  }

  return null;
}

function getAirportByPoint(point) {
  const normalizedPoint = normalizePoint(point);
  if (!normalizedPoint) {
    return null;
  }

  const airports = Object.values(AIRPORT_GEOFENCES);
  for (const airport of airports) {
    if (isPointInsidePolygon(normalizedPoint, airport.polygon)) {
      return {
        code: airport.code,
        name: airport.name,
        pickupInstructions: airport.pickupInstructions,
      };
    }
  }

  return null;
}

function getAirportLotByPoint(point, rideCategory = 'regular') {
  const airport = getAirportByPoint(point);
  if (!airport) {
    return null;
  }

  const fullAirport = AIRPORT_GEOFENCES[airport.code];
  const queueGroup = normalizeRideCategory(rideCategory);
  const selectedLot = fullAirport.tnpLots[queueGroup];

  if (!selectedLot) {
    return null;
  }

  const normalizedPoint = normalizePoint(point);
  if (!normalizedPoint) {
    return null;
  }

  const inSelectedLot = isPointInsidePolygon(normalizedPoint, selectedLot.polygon);

  return {
    airportCode: fullAirport.code,
    airportName: fullAirport.name,
    queueGroup,
    lotCode: selectedLot.code,
    lotName: selectedLot.name,
    inSelectedLot,
    requiredLot: selectedLot,
  };
}

function getAirportPickupZoneByPoint(point) {
  const airport = getAirportByPoint(point);
  if (!airport) {
    return null;
  }

  const fullAirport = AIRPORT_GEOFENCES[airport.code];
  const zone = findZoneByPoint(point, fullAirport.pickupZones);

  if (!zone) {
    return null;
  }

  return {
    airportCode: fullAirport.code,
    airportName: fullAirport.name,
    zone,
  };
}

function isEventQueueWindowOpen(eventCode, referenceDate = new Date()) {
  const event = EVENT_GEOFENCES[eventCode];
  if (!event) {
    return false;
  }

  if (String(process.env.EVENT_QUEUE_FORCE_OPEN || '').toLowerCase() === 'true') {
    return true;
  }

  const { hour, day } = getChicagoDateParts(referenceDate);
  const queueWindow = event.queueWindow || {};
  const startHour = Number(queueWindow.startHourLocal ?? 15);
  const endHour = Number(queueWindow.endHourLocal ?? 23);
  const activeDays = Array.isArray(queueWindow.activeDays) && queueWindow.activeDays.length
    ? queueWindow.activeDays
    : [4, 5, 6, 0];

  return activeDays.includes(day) && hour >= startHour && hour < endHour;
}

function getEventByPoint(point, { requireQueueOpen = false } = {}) {
  const normalizedPoint = normalizePoint(point);
  if (!normalizedPoint) {
    return null;
  }

  for (const event of Object.values(EVENT_GEOFENCES)) {
    if (!isPointInsidePolygon(normalizedPoint, event.venuePolygon)) {
      continue;
    }

    const queueOpen = isEventQueueWindowOpen(event.code);
    if (requireQueueOpen && !queueOpen) {
      continue;
    }

    return {
      code: event.code,
      name: event.name,
      queueOpen,
      riderInstructions: event.riderInstructions,
    };
  }

  return null;
}

function getEventStagingAreaByPoint(point, rideCategory = 'regular') {
  const event = getEventByPoint(point);
  if (!event) {
    return null;
  }

  const fullEvent = EVENT_GEOFENCES[event.code];
  const queueGroup = normalizeRideCategory(rideCategory);
  const stagingArea = fullEvent.stagingAreas[queueGroup];

  if (!stagingArea) {
    return null;
  }

  const normalizedPoint = normalizePoint(point);
  if (!normalizedPoint) {
    return null;
  }

  const inStagingArea = isPointInsidePolygon(normalizedPoint, stagingArea.polygon);

  return {
    eventCode: fullEvent.code,
    eventName: fullEvent.name,
    queueGroup,
    queueOpen: isEventQueueWindowOpen(fullEvent.code),
    stagingAreaCode: stagingArea.code,
    stagingAreaName: stagingArea.name,
    inStagingArea,
    requiredStagingArea: stagingArea,
  };
}

function getEventPickupLaneByPoint(point) {
  const event = getEventByPoint(point);
  if (!event) {
    return null;
  }

  const fullEvent = EVENT_GEOFENCES[event.code];
  const lane = findZoneByPoint(point, fullEvent.pickupLanes);

  if (!lane) {
    return null;
  }

  return {
    eventCode: fullEvent.code,
    eventName: fullEvent.name,
    lane,
  };
}

function getAirportGeofences() {
  return Object.values(AIRPORT_GEOFENCES).map(airport => ({
    code: airport.code,
    name: airport.name,
    polygon: airport.polygon,
    tnpLots: airport.tnpLots,
    pickupZones: airport.pickupZones,
  }));
}

function getEventGeofences() {
  return Object.values(EVENT_GEOFENCES).map(event => ({
    code: event.code,
    name: event.name,
    venuePolygon: event.venuePolygon,
    queueWindow: event.queueWindow,
    stagingAreas: event.stagingAreas,
    pickupLanes: event.pickupLanes,
  }));
}

function getOperationsContextByPoint(point, { rideCategory = 'regular' } = {}) {
  const airport = getAirportByPoint(point);
  if (airport) {
    const lotContext = getAirportLotByPoint(point, rideCategory);
    const pickupZone = getAirportPickupZoneByPoint(point);

    return {
      operationType: 'airport',
      airportCode: airport.code,
      airportName: airport.name,
      queueGroup: normalizeRideCategory(rideCategory),
      lotContext,
      pickupZone,
    };
  }

  const event = getEventByPoint(point);
  if (event) {
    const stagingContext = getEventStagingAreaByPoint(point, rideCategory);
    const pickupLane = getEventPickupLaneByPoint(point);

    return {
      operationType: 'event',
      eventCode: event.code,
      eventName: event.name,
      queueGroup: normalizeRideCategory(rideCategory),
      queueOpen: event.queueOpen,
      stagingContext,
      pickupLane,
    };
  }

  return {
    operationType: 'city',
    queueGroup: normalizeRideCategory(rideCategory),
  };
}

module.exports = {
  SUPPORTED_EVENT_CODES,
  AIRPORT_GEOFENCES,
  EVENT_GEOFENCES,
  normalizeRideCategory,
  getAirportByPoint,
  getAirportLotByPoint,
  getAirportPickupZoneByPoint,
  getEventByPoint,
  getEventStagingAreaByPoint,
  getEventPickupLaneByPoint,
  isEventQueueWindowOpen,
  getAirportGeofences,
  getEventGeofences,
  getOperationsContextByPoint,
};
