// Built-in branch curriculum framework (used when student has no uploaded syllabus)
// Each subject: { name, source: 'builtin', units: [{ name, topics: [strings] }] }

export const BRANCHES = {
  EEE: {
    code: 'EEE',
    name: 'Electrical & Electronics Engineering',
    subjects: [
      { name: 'Basic Electrical Engineering', source: 'builtin', units: [
        { name: 'DC Circuits', topics: ['Ohm\u2019s law', 'Kirchhoff\u2019s laws', 'Series and parallel circuits', 'Thevenin and Norton theorems', 'Maximum power transfer theorem'] },
        { name: 'AC Circuits', topics: ['Phasor representation', 'RLC circuits', 'Power in AC circuits', 'Power factor', 'Resonance'] },
        { name: 'Measuring Basics', topics: ['Units and standards', 'Errors in measurement', 'Multimeter usage', 'Ammeter and voltmeter'] },
      ]},
      { name: 'Electrical Machines', source: 'builtin', units: [
        { name: 'DC Machines', topics: ['DC motor working principle', 'EMF equation', 'Back EMF', 'Speed control', 'Losses and efficiency', 'Starting methods'] },
        { name: 'Transformers', topics: ['Construction', 'Working principle', 'EMF equation', 'Transformer losses', 'Efficiency', 'Voltage regulation', 'Types of transformers', 'kVA rating'] },
        { name: 'AC Machines', topics: ['Synchronous motor', 'Synchronous generator', 'Induction motor', 'Slip', 'Torque-speed characteristics', 'Synchronous speed', 'Starting of induction motor', 'Why synchronous motor is not self-starting'] },
      ]},
      { name: 'Power Systems', source: 'builtin', units: [
        { name: 'Generation', topics: ['Thermal power plant', 'Hydro power plant', 'Nuclear power plant', 'Renewable sources'] },
        { name: 'Transmission & Distribution', topics: ['Transmission lines', 'Distribution systems', 'Line losses', 'Reactors', 'Ferranti effect', 'FACTS basics'] },
        { name: 'Protection', topics: ['Circuit breakers', 'Fuses', 'Relays', 'Earthing', 'CT and PT', 'Short circuit basics', 'Switchgear'] },
      ]},
      { name: 'Power Electronics', source: 'builtin', units: [
        { name: 'Power Semiconductor Devices', topics: ['Diode', 'SCR / Thyristor', 'MOSFET', 'IGBT', 'GTO', 'Switching characteristics'] },
        { name: 'Converters', topics: ['Rectifiers', 'Inverters', 'Choppers', 'Cycloconverters', 'AC voltage controllers', 'PWM techniques'] },
        { name: 'Applications', topics: ['Power factor correction', 'HVDC basics', 'UPS', 'Motor drives', 'Speed control of motors'] },
      ]},
      { name: 'Control Systems', source: 'builtin', units: [
        { name: 'Basics', topics: ['Open and closed loop control', 'Transfer function', 'Block diagram reduction', 'Signal flow graphs'] },
        { name: 'Time & Frequency Response', topics: ['Time response', 'Steady state error', 'Stability', 'Routh-Hurwitz criterion', 'Bode plots', 'Nyquist criterion', 'Root locus'] },
        { name: 'Controllers', topics: ['P, PI, PID controllers', 'Compensators', 'State-space basics'] },
      ]},
      { name: 'Measurements & Instrumentation', source: 'builtin', units: [
        { name: 'Measurement', topics: ['Instruments types', 'Bridge circuits', 'Potentiometer', 'Transducers', 'Sensors', 'Calibration'] },
        { name: 'Electronic Measurement', topics: ['CRO', 'Digital multimeter', 'Signal generators', 'Data acquisition'] },
      ]},
      { name: 'Switchgear & Protection', source: 'builtin', units: [
        { name: 'Switchgear', topics: ['Switchgear basics', 'MCB and MCCB', 'Contactors', 'Isolators', 'Earthing systems'] },
        { name: 'Protection', topics: ['Protective relays', 'Overcurrent protection', 'Distance protection', 'Differential protection', 'Protection coordination'] },
      ]},
      { name: 'Practical Electrical Concepts', source: 'supplement', units: [
        { name: 'Field Practice', topics: ['Earthing requirements', 'Star and delta connections', 'Substation basics', 'Cable sizing', 'Energy meters', 'Safety practices', 'Troubleshooting motors', 'Why transformers rated in kVA'] },
      ]},
    ],
  },
  CSE: {
    code: 'CSE',
    name: 'Computer Science Engineering',
    subjects: [
      { name: 'Programming', source: 'builtin', units: [
        { name: 'Language Fundamentals', topics: ['Variables and data types', 'Control flow', 'Functions', 'Pointers and references', 'Recursion', 'Strings'] },
        { name: 'Oops Concepts', topics: ['Classes and objects', 'Inheritance', 'Polymorphism', 'Encapsulation', 'Abstraction', 'Interfaces and abstract classes'] },
        { name: 'Problem Solving', topics: ['Problem decomposition', 'Pseudo code', 'Complexity basics', 'Debugging scenarios'] },
      ]},
      { name: 'Data Structures', source: 'builtin', units: [
        { name: 'Linear', topics: ['Arrays', 'Linked lists', 'Stacks', 'Queues'] },
        { name: 'Non-linear', topics: ['Trees', 'Binary search trees', 'Heaps', 'Graphs', 'Hash tables'] },
        { name: 'Algorithms on DS', topics: ['Traversals', 'Sorting algorithms', 'Searching', 'Graph algorithms (BFS, DFS)', 'Complexity analysis'] },
      ]},
      { name: 'Algorithms', source: 'builtin', units: [
        { name: 'Core Topics', topics: ['Time and space complexity', 'Divide and conquer', 'Greedy algorithms', 'Dynamic programming', 'Backtracking', 'Sorting algorithms'] },
      ]},
      { name: 'Database Management Systems', source: 'builtin', units: [
        { name: 'Fundamentals', topics: ['ER model', 'Relational model', 'Keys', 'Normalization (1NF-3NF, BCNF)'] },
        { name: 'SQL', topics: ['DDL and DML', 'Joins', 'Aggregation', 'Subqueries', 'Indexes'] },
        { name: 'Transactions', topics: ['ACID properties', 'Concurrency control', 'Locking', 'Deadlocks', 'Transaction isolation levels'] },
      ]},
      { name: 'Operating Systems', source: 'builtin', units: [
        { name: 'Process Management', topics: ['Processes and threads', 'Process scheduling', 'Synchronization', 'Deadlock', 'IPC'] },
        { name: 'Memory Management', topics: ['Paging', 'Segmentation', 'Virtual memory', 'Page replacement', 'Memory allocation'] },
        { name: 'Storage', topics: ['File systems', 'Disk scheduling', 'I/O systems'] },
      ]},
      { name: 'Computer Networks', source: 'builtin', units: [
        { name: 'Foundation', topics: ['OSI model', 'TCP/IP model', 'IP addressing', 'Subnetting', 'DNS', 'HTTP/HTTPS'] },
        { name: 'Protocols', topics: ['TCP and UDP', 'Routing protocols', 'ARP', 'DHCP', 'FTP', 'SMTP'] },
        { name: 'Applications', topics: ['Network troubleshooting', 'Firewalls', 'Load balancing', 'Client-server model', 'Web APIs'] },
      ]},
      { name: 'Software Engineering', source: 'builtin', units: [
        { name: 'Process', topics: ['SDLC', 'Agile and Scrum', 'Requirement analysis', 'UML basics'] },
        { name: 'Quality', topics: ['Testing types', 'Unit testing', 'Code review', 'Version control (Git)', 'CI/CD concepts'] },
      ]},
      { name: 'Practical Computer Concepts', source: 'supplement', units: [
        { name: 'Field Practice', topics: ['Debugging code', 'Error handling', 'API failures', 'Memory leaks', 'SQL query failures', 'Version control workflows', 'Code optimization', 'System design basics'] },
      ]},
    ],
  },
  ECE: {
    code: 'ECE',
    name: 'Electronics & Communication Engineering',
    subjects: [
      { name: 'Analog Electronics', source: 'builtin', units: [
        { name: 'Devices', topics: ['PN junction diode', 'BJT', 'FET and MOSFET', 'Zener diode', 'Rectifiers', 'Amplifiers', 'Oscillators'] },
        { name: 'Amplifier Circuits', topics: ['Op-amp basics', 'Inverting and non-inverting', 'Feedback', 'Filters', 'Comparators', '555 timer'] },
      ]},
      { name: 'Digital Electronics', source: 'builtin', units: [
        { name: 'Logic', topics: ['Number systems', 'Boolean algebra', 'Logic gates', 'K-map', 'Combinational circuits'] },
        { name: 'Sequential', topics: ['Flip-flops', 'Counters', 'Registers', 'Multiplexers and demultiplexers', 'ADCs and DACs'] },
      ]},
      { name: 'Signals & Systems', source: 'builtin', units: [
        { name: 'Analysis', topics: ['Continuous and discrete signals', 'LTI systems', 'Convolution', 'Fourier series and transform', 'Laplace transform', 'Z-transform', 'Sampling theorem'] },
      ]},
      { name: 'Communication Systems', source: 'builtin', units: [
        { name: 'Analogue', topics: ['AM', 'FM', 'PM', 'Modulators and demodulators', 'Noise in communication', 'SNR'] },
        { name: 'Digital', topics: ['PCM', 'ASK/FSK/PSK/QPSK', 'Digital modulation', 'Channel capacity', 'Error detection and correction'] },
        { name: 'Wireless', topics: ['Cellular concepts', 'GSM basics', 'Multiple access (FDMA/TDMA/CDMA)', 'Wi-Fi basics', 'Bluetooth basics'] },
      ]},
      { name: 'Microprocessors & Microcontrollers', source: 'builtin', units: [
        { name: 'Architecture', topics: ['8086 architecture', '8051 microcontroller', 'ARM basics', 'Instruction set', 'Addressing modes'] },
        { name: 'Interfacing', topics: ['Memory interfacing', 'I/O interfacing', 'Interrupts', 'Timers and counters', 'Serial communication (UART, SPI, I2C)', 'GPIO'] },
      ]},
      { name: 'Embedded Systems', source: 'builtin', units: [
        { name: 'Basics', topics: ['Embedded system components', 'RTOS basics', 'Arduino and Raspberry Pi', 'Sensor interfacing', 'Firmware concepts'] },
      ]},
      { name: 'Electronic Devices', source: 'builtin', units: [
        { name: 'Semiconductors', topics: ['Semiconductor physics', 'Diode characteristics', 'Transistor characteristics', 'Biasing', 'Small signal model'] },
      ]},
      { name: 'Practical Electronics Concepts', source: 'supplement', units: [
        { name: 'Field Practice', topics: ['Sensor troubleshooting', 'Signal problems', 'Circuit faults', 'Microcontroller behavior', 'Oscilloscope usage', 'Soldering basics', 'Prototyping'] },
      ]},
    ],
  },
  CIVIL: {
    code: 'CIVIL',
    name: 'Civil Engineering',
    subjects: [
      { name: 'Structural Engineering', source: 'builtin', units: [
        { name: 'Analysis', topics: ['Bending moment and shear force', 'Stress and strain', 'Beam deflection', 'Columns and struts', 'Trusses', 'Bending equation', 'Torsion'] },
        { name: 'Structures', topics: ['RCC basics', 'Steel structures', 'Load combinations', 'Design of beams and slabs'] },
      ]},
      { name: 'Concrete Technology', source: 'builtin', units: [
        { name: 'Materials', topics: ['Cement types', 'Aggregates', 'Water-cement ratio', 'Admixtures', 'Concrete mix design', 'Workability', 'Curing', 'Concrete testing (slump)'] },
      ]},
      { name: 'Geotechnical Engineering', source: 'builtin', units: [
        { name: 'Soil', topics: ['Soil classification', 'Atterberg limits', 'Compaction', 'Consolidation', 'Bearing capacity', 'Shear strength of soil', 'Foundation types'] },
      ]},
      { name: 'Surveying', source: 'builtin', units: [
        { name: 'Techniques', topics: ['Chain and compass surveying', 'Leveling', 'Theodolite', 'Total station', 'GPS/GNSS', 'Contouring', 'Distance measurement'] },
      ]},
      { name: 'Transportation Engineering', source: 'builtin', units: [
        { name: 'Roads & Traffic', topics: ['Highway alignment', 'Pavement types (flexible and rigid)', 'Bituminous materials', 'Traffic studies', 'Geometric design', 'Road construction'] },
      ]},
      { name: 'Environmental Engineering', source: 'builtin', units: [
        { name: 'Water & Waste', topics: ['Water quality parameters', 'Water treatment processes', 'Wastewater treatment', 'Solid waste management', 'Air pollution basics'] },
      ]},
      { name: 'Construction Management', source: 'builtin', units: [
        { name: 'Management', topics: ['Project planning', 'CPM and PERT', 'Resource management', 'Cost estimation', 'Quality control on site', 'Safety on site'] },
      ]},
      { name: 'Fluid Mechanics', source: 'builtin', units: [
        { name: 'Basics', topics: ['Fluid properties', 'Hydrostatic pressure', 'Bernoulli\u2019s equation', 'Flow measurement', 'Pipe flow', 'Laminar and turbulent flow'] },
      ]},
      { name: 'Practical Civil Concepts', source: 'supplement', units: [
        { name: 'Field Practice', topics: ['Site problems', 'Material selection', 'Structural situations', 'Construction defects', 'Surveying problems', 'Column and beam placement', 'Reinforcement detailing', 'Curing issues'] },
      ]},
    ],
  },
};

// Aptitude topics used across all branches
export const APTITUDE_TOPICS = [
  'Percentages',
  'Ratios and Proportions',
  'Averages',
  'Profit and Loss',
  'Time and Work',
  'Time, Speed and Distance',
  'Simple and Compound Interest',
  'Probability',
  'Permutations and Combinations',
  'Number Systems',
  'Data Interpretation',
  'Number Series',
  'Logical Reasoning',
  'Coding-Decoding',
  'Blood Relations',
  'Directions',
  'Puzzles',
  'Syllogisms',
];

// English topics
export const ENGLISH_TOPICS = [
  'Grammar',
  'Sentence Correction',
  'Vocabulary',
  'Fill in the Blanks',
  'Error Identification',
  'Sentence Formation',
  'Professional English',
  'Interview Vocabulary',
];

export function getBranchSubjects(code) {
  const branch = BRANCHES[code];
  if (!branch) return [];
  return branch.subjects || [];
}

export function getAllTopicsForBranch(code) {
  const topics = [];
  const branch = BRANCHES[code];
  if (!branch) return topics;
  for (const subject of branch.subjects) {
    for (const unit of subject.units || []) {
      for (const topic of unit.topics || []) {
        topics.push({ subject: subject.name, unit: unit.name, topic, source: subject.source });
      }
    }
  }
  return topics;
}