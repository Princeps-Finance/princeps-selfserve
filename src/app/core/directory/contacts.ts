export interface Agent {
  name: string;
  /** Translation key for the region name. */
  regionKey: string;
  phone: string;
}

export interface Office {
  city: string;
  address: string;
  phone: string;
  hoursFrom: string;
  hoursTo: string;
}

export const AGENTS: readonly Agent[] = [
  { name: 'Adeola Bakare', regionKey: 'region.lagos_sw', phone: '+234 803 411 2201' },
  { name: 'Chinedu Okafor', regionKey: 'region.se_ss', phone: '+234 806 552 8842' },
  { name: 'Fatima Ibrahim', regionKey: 'region.kano_nw', phone: '+234 809 220 7714' },
  { name: 'Musa Danladi', regionKey: 'region.adamawa_ne', phone: '+234 807 118 6633' },
  { name: 'Grace Okon', regionKey: 'region.abuja_nc', phone: '+234 812 774 9910' },
];

export const OFFICES: readonly Office[] = [
  {
    city: 'Lagos',
    address: '14 Adeola Odeku Street, Victoria Island, Lagos',
    phone: '+234 1 342 8800',
    hoursFrom: '9:00',
    hoursTo: '17:00',
  },
  {
    city: 'Adamawa',
    address: 'Plot 22 Galadima Aminu Way, Jimeta, Yola, Adamawa',
    phone: '+234 75 262 4411',
    hoursFrom: '9:00',
    hoursTo: '16:30',
  },
];
