export default [
  // Topic: Grammar (4 questions)
  {
    category: 'english',
    topic: 'Grammar',
    difficulty: 1,
    qtype: 'truefalse',
    text: 'True or False: In the sentence "The team is working on the project," the collective noun "team" correctly takes a singular verb.',
    options: ['True', 'False'],
    correctAnswer: 'True',
    explanation: 'Collective nouns like "team," "committee," and "group" take singular verbs in standard English. Since "team" is treated as a single unit, "is" is the correct verb. "The team are working" would be an error in formal professional English.'
  },
  {
    category: 'english',
    topic: 'Grammar',
    difficulty: 1,
    qtype: 'mcq',
    text: 'Which sentence uses the correct tense?',
    options: [
      'A) She have completed the assignment.',
      'B) She has completed the assignment.',
      'C) She had completed the assignment yesterday.',
      'D) She have been completed the assignment.'
    ],
    correctAnswer: 'She has completed the assignment.',
    explanation: 'With a third-person singular subject like "she," we use "has" in the present perfect tense. Option A incorrectly uses "have" with a singular subject. Option C uses past perfect, which requires a past reference point that is not provided. Option D is grammatically incorrect because "have been completed" is passive voice.'
  },
  {
    category: 'english',
    topic: 'Grammar',
    difficulty: 1,
    qtype: 'fillblank',
    text: 'Complete the sentence: "Neither the manager _____ the employees were available for the meeting."',
    options: [],
    correctAnswer: 'nor',
    explanation: '"Neither" always pairs with "nor" in the correlative conjunction pair "neither...nor." Avoid "neither...or," which is incorrect. When the subjects differ in number, the verb agrees with the nearer subject, so "were" stays correct.'
  },
  {
    category: 'english',
    topic: 'Grammar',
    difficulty: 2,
    qtype: 'mcq',
    text: 'Identify the correct preposition: "She is keen _____ learning new skills."',
    options: [
      'A) on',
      'B) in',
      'C) at',
      'D) for'
    ],
    correctAnswer: 'on',
    explanation: 'The phrase "keen on" is a fixed prepositional expression meaning strongly interested in something. The other prepositions do not combine with "keen" in this context. Collocations like this matter in professional written English.'
  },

  // Topic: Sentence Correction (4 questions)
  {
    category: 'english',
    topic: 'Sentence Correction',
    difficulty: 1,
    qtype: 'truefalse',
    text: 'True or False: "He and I went to the conference" is a correctly written sentence.',
    options: ['True', 'False'],
    correctAnswer: 'True',
    explanation: 'Compound subjects use subject pronouns ("he" and "I"), not object pronouns ("him" and "me"). The convention is to place the other person first and use "I" last. The verb "went" agrees correctly with the plural subject.'
  },
  {
    category: 'english',
    topic: 'Sentence Correction',
    difficulty: 1,
    qtype: 'mcq',
    text: 'Which sentence is grammatically correct?',
    options: [
      'A) The data shows that sales have increased.',
      'B) The data show that sales has increased.',
      'C) The data shows that sales has increased.',
      'D) The data show that sales have increased.'
    ],
    correctAnswer: 'The data shows that sales have increased.',
    explanation: 'In modern professional English, "data" is commonly treated as singular (like "information"), so it takes "shows." "Sales" is plural and takes "have increased." Option B treats both incorrectly by adding the opposite articles. Option D treats "data" as plural throughout, which most now avoid.'
  },
  {
    category: 'english',
    topic: 'Sentence Correction',
    difficulty: 2,
    qtype: 'mcq',
    text: 'Choose the correctly written sentence:',
    options: [
      'A) If I would have known, I would have helped.',
      'B) If I had known, I would have helped.',
      'C) If I have known, I would helped.',
      'D) If I knew, I would have helped.'
    ],
    correctAnswer: 'If I had known, I would have helped.',
    explanation: 'This is a third conditional expressing a past unreal situation. It requires past perfect ("had known") in the if-clause and "would have + past participle" in the result clause. Option A wrongly uses "would have" in the if-clause. Options C and D use the wrong tense forms.'
  },
  {
    category: 'english',
    topic: 'Sentence Correction',
    difficulty: 2,
    qtype: 'mcq',
    text: 'Which sentence is correctly punctuated and written?',
    options: [
      'A) The manager said "we need to improve our processes".',
      'B) The manager said, "We need to improve our processes."',
      'C) The manager said, "We need to improve our processes"',
      'D) The manager said "We need to improve our processes."'
    ],
    correctAnswer: 'The manager said, "We need to improve our processes."',
    explanation: 'Direct speech requires a comma before the opening quotation mark, a capital letter at the start of the quoted sentence, and a period inside the closing quotation mark. Option A lacks the comma and capital. Option C lacks the closing period. Option D lacks the comma after "said."'
  },

  // Topic: Vocabulary (4 questions)
  {
    category: 'english',
    topic: 'Vocabulary',
    difficulty: 1,
    qtype: 'truefalse',
    text: 'True or False: "Initiative" in a professional context refers to the ability to act and make decisions independently.',
    options: ['True', 'False'],
    correctAnswer: 'True',
    explanation: '"Initiative" is the ability to assess a situation and act independently without being told what to do. Employers frequently look for candidates who show initiative. The statement accurately describes the word\'s professional meaning.'
  },
  {
    category: 'english',
    topic: 'Vocabulary',
    difficulty: 1,
    qtype: 'mcq',
    text: 'Choose the correct meaning of "meticulous":',
    options: [
      'A) Careless and hasty',
      'B) Extremely careful and precise',
      'C) Extremely talkative',
      'D) Easily annoyed'
    ],
    correctAnswer: 'Extremely careful and precise',
    explanation: '"Meticulous" means showing great attention to detail and precision. In interviews it is a positive trait that emphasizes careful, high-quality work. The other options describe opposite or unrelated characteristics.'
  },
  {
    category: 'english',
    topic: 'Vocabulary',
    difficulty: 2,
    qtype: 'fillblank',
    text: 'Fill in the blank: "A person who recovers quickly from difficulties is described as _____."',
    options: [],
    correctAnswer: 'resilient',
    explanation: '"Resilient" describes the ability to recover quickly from setbacks and keep going. In interviews, employers value resilience because it shows you can handle workplace pressure. Words like "fragile" or "rigid" convey the opposite meaning.'
  },
  {
    category: 'english',
    topic: 'Vocabulary',
    difficulty: 3,
    qtype: 'mcq',
    text: 'What does "streamline" mean in a business context?',
    options: [
      'A) To make a process more efficient',
      'B) To delay a project',
      'C) To complicate a procedure',
      'D) To hire more employees'
    ],
    correctAnswer: 'To make a process more efficient',
    explanation: '"Streamline" means improving a process by removing unnecessary steps to make it more efficient. It is widely used in business for process optimization. The other options describe delaying, complicating, or staffing, which are different concepts.'
  },

  // Topic: Fill in the Blanks (4 questions)
  {
    category: 'english',
    topic: 'Fill in the Blanks',
    difficulty: 1,
    qtype: 'fillblank',
    text: 'Complete the sentence: "I am writing to _____ the position of Software Engineer advertised on your website."',
    options: [],
    correctAnswer: 'apply for',
    explanation: 'The correct collocation is "apply for" a position or job. "Apply to" is used with institutions (for example, "apply to a company"). "Apply with" and "apply at" are not standard in this context.'
  },
  {
    category: 'english',
    topic: 'Fill in the Blanks',
    difficulty: 1,
    qtype: 'fillblank',
    text: 'Complete the sentence: "I would appreciate _____ if you could review my resume."',
    options: [],
    correctAnswer: 'it',
    explanation: '"I would appreciate it if" is a standard polite expression. The word "it" acts as a meaningful filler object, so the sentence is grammatically complete. Professionals often use this phrase when making polite requests in email.'
  },
  {
    category: 'english',
    topic: 'Fill in the Blanks',
    difficulty: 2,
    qtype: 'fillblank',
    text: 'Complete the sentence: "Please let me know _____ any questions arise."',
    options: [],
    correctAnswer: 'if',
    explanation: '"If" introduces a conditional clause meaning "in the case that," which fits a polite request. "When" would imply questions are certain to arise, and "that" does not fit the structure here. This phrasing is common in professional correspondence.'
  },
  {
    category: 'english',
    topic: 'Fill in the Blanks',
    difficulty: 3,
    qtype: 'fillblank',
    text: 'Complete the sentence: "The project deadline has been _____ to next Friday."',
    options: [],
    correctAnswer: 'extended',
    explanation: '"Extended" means stretching a time limit further, which is the standard term for moving a deadline later. "Expanded" refers to size or scope, "delayed" has negative connotations, and "postponed" is used when an event is moved completely. "Extended" is most precise here.'
  },

  // Topic: Error Identification (4 questions)
  {
    category: 'english',
    topic: 'Error Identification',
    difficulty: 1,
    qtype: 'truefalse',
    text: 'True or False: The sentence "The information in these reports are very useful" is grammatically correct.',
    options: ['True', 'False'],
    correctAnswer: 'False',
    explanation: '"Information" is an uncountable noun and must take the singular verb "is," not the plural "are." The correct sentence is "The information in these reports is very useful." This is a common subject-verb agreement error.'
  },
  {
    category: 'english',
    topic: 'Error Identification',
    difficulty: 2,
    qtype: 'mcq',
    text: 'Find the error in: "Each of the students have submitted their assignments."',
    options: [
      'A) Each of the students',
      'B) have submitted',
      'C) their assignments',
      'D) No error'
    ],
    correctAnswer: 'have submitted',
    explanation: '"Each" is singular, so the verb must be singular: "Each of the students has submitted their assignments." The error is in part B. Note that "their" as a singular gender-neutral pronoun is widely accepted in modern English.'
  },
  {
    category: 'english',
    topic: 'Error Identification',
    difficulty: 2,
    qtype: 'mcq',
    text: 'Find the error in: "I look forward to hear from you at the interview."',
    options: [
      'A) I look forward',
      'B) to hear',
      'C) from you',
      'D) No error'
    ],
    correctAnswer: 'to hear',
    explanation: 'After "look forward to," the verb must be in the gerund (-ing) form, so "to hear" is the error. The correct sentence is "I look forward to hearing from you." Here "to" is a preposition, not part of an infinitive.'
  },
  {
    category: 'english',
    topic: 'Error Identification',
    difficulty: 3,
    qtype: 'mcq',
    text: 'Find the error in: "The reason is because the project was delayed."',
    options: [
      'A) The reason is',
      'B) because the project',
      'C) was delayed',
      'D) No error'
    ],
    correctAnswer: 'because the project',
    explanation: '"The reason is because" is redundant; use either "The reason is that" or simply "because." The error is in part B. A correct version is "The reason is that the project was delayed" or "The project was delayed because of a scheduling issue."'
  },

  // Topic: Professional English (4 questions)
  {
    category: 'english',
    topic: 'Professional English',
    difficulty: 1,
    qtype: 'fillblank',
    text: 'Complete the professional email greeting: "_____ Hiring Manager,"',
    options: [],
    correctAnswer: 'Dear',
    explanation: '"Dear" is the standard professional salutation, followed by the recipient\'s name or title, such as "Dear Hiring Manager." It strikes the right formal tone for job applications. Casual openers like "Hey" are inappropriate for professional correspondence.'
  },
  {
    category: 'english',
    topic: 'Professional English',
    difficulty: 2,
    qtype: 'mcq',
    text: 'How should you politely ask for clarification in a meeting?',
    options: [
      'A) "I don\'t understand what you mean."',
      'B) "Could you elaborate on that point, please?"',
      'C) "That doesn\'t make sense."',
      'D) "You\'re wrong about that."'
    ],
    correctAnswer: 'Could you elaborate on that point, please?',
    explanation: '"Could you elaborate on that point, please?" is polite, professional, and shows engagement. The other options are too direct, dismissive, or confrontational, which is inappropriate in a professional setting.'
  },
  {
    category: 'english',
    topic: 'Professional English',
    difficulty: 2,
    qtype: 'mcq',
    text: 'Which is the best way to respond to constructive feedback?',
    options: [
      'A) "But I already did it my way."',
      'B) "Thank you for the feedback. I will work on improving that."',
      'C) "I disagree completely."',
      'D) "That\'s not fair."'
    ],
    correctAnswer: 'Thank you for the feedback. I will work on improving that.',
    explanation: 'Acknowledging feedback positively and showing a willingness to improve demonstrates professionalism and maturity. Defensive or dismissive responses can damage your professional reputation and working relationships.'
  },
  {
    category: 'english',
    topic: 'Professional English',
    difficulty: 3,
    qtype: 'mcq',
    text: 'Which sentence best describes a project status update?',
    options: [
      'A) "We did some stuff and it\'s almost done."',
      'B) "The project is 75% complete, with testing scheduled for next week."',
      'C) "Things are going okay, I guess."',
      'D) "We\'re working on it, nothing new to report."'
    ],
    correctAnswer: 'The project is 75% complete, with testing scheduled for next week.',
    explanation: 'A professional status update includes specific metrics (75% complete) and clear next steps (testing scheduled). Vague updates such as "things are going okay" or "we did some stuff" fail to communicate progress clearly to stakeholders.'
  },

  // Topic: Interview Vocabulary (4 questions)
  {
    category: 'english',
    topic: 'Interview Vocabulary',
    difficulty: 1,
    qtype: 'fillblank',
    text: 'Fill in the blank: "Working together with others toward a common goal is called _____."',
    options: [],
    correctAnswer: 'collaboration',
    explanation: '"Collaboration" refers to working jointly with others to achieve a shared objective. In interviews, mentioning collaboration shows you are a team player. Words like "competition" or "coercion" have different or opposite meanings.'
  },
  {
    category: 'english',
    topic: 'Interview Vocabulary',
    difficulty: 1,
    qtype: 'mcq',
    text: 'In an interview, what does "can you walk me through your resume" mean?',
    options: [
      'A) The interviewer wants to see your resume on paper',
      'B) The interviewer wants you to explain your experience and qualifications',
      'C) The interviewer wants you to leave the room',
      'D) The interviewer wants you to read your resume aloud'
    ],
    correctAnswer: 'The interviewer wants you to explain your experience and qualifications',
    explanation: '"Walk me through your resume" is a common interview question asking you to narrate your professional journey. It tests your communication skills and your ability to highlight the most relevant experience concisely.'
  },
  {
    category: 'english',
    topic: 'Interview Vocabulary',
    difficulty: 2,
    qtype: 'mcq',
    text: 'In an interview, what does "feasible" mean when discussing project ideas?',
    options: [
      'A) Impossible to achieve',
      'B) Possible and practical to do',
      'C) Extremely expensive',
      'D) Not worth considering'
    ],
    correctAnswer: 'Possible and practical to do',
    explanation: '"Feasible" means something is possible and practical to implement. In interviews, saying an approach is feasible shows you can assess practicality and make grounded decisions. The other options describe the opposite or unrelated ideas.'
  },
  {
    category: 'english',
    topic: 'Interview Vocabulary',
    difficulty: 3,
    qtype: 'mcq',
    text: 'How should you best describe a weakness in an interview?',
    options: [
      'A) "I don\'t have any weaknesses."',
      'B) "I\'m a perfectionist, which means I sometimes spend too much time on details, but I\'m learning to prioritize."',
      'C) "I hate working with people."',
      'D) "I\'m always late to everything."'
    ],
    correctAnswer: 'I\'m a perfectionist, which means I sometimes spend too much time on details, but I\'m learning to prioritize.',
    explanation: 'The strongest approach is to mention a real but manageable weakness and show self-awareness by explaining how you are addressing it. This demonstrates honesty, a growth mindset, and professional maturity. Denying weaknesses or admitting serious ones backfires.'
  },

  // Topic: Common Mistakes (4 questions)
  {
    category: 'english',
    topic: 'Common Mistakes',
    difficulty: 1,
    qtype: 'fillblank',
    text: 'Complete the sentence: "This is _____ important decision."',
    options: [],
    correctAnswer: 'an',
    explanation: 'Use "an" before words that begin with a vowel sound and "a" before consonant sounds. "Important" begins with the vowel sound /i/, so "an" is correct. The article must agree with the singular countable noun "decision."'
  },
  {
    category: 'english',
    topic: 'Common Mistakes',
    difficulty: 2,
    qtype: 'mcq',
    text: 'Which is the correct professional alternative to "I am having a doubt"?',
    options: [
      'A) "I am having a doubt."',
      'B) "I have a query."',
      'C) "I am having doubt."',
      'D) "I having a doubt."'
    ],
    correctAnswer: 'I have a query.',
    explanation: '"I have a query" or "I have a question" is the professional way to express this. "Having a doubt" is an Indian English phrasing not used in standard English, and "doubt" implies disbelief rather than a question.'
  },
  {
    category: 'english',
    topic: 'Common Mistakes',
    difficulty: 2,
    qtype: 'fillblank',
    text: 'Correct the error: "I need to discuss _____ the project details with the team." (Enter the correct preposition, or write "no preposition" if none is needed.)',
    options: [],
    correctAnswer: 'no preposition',
    explanation: '"Discuss" is a transitive verb and takes a direct object without a preposition. Say "discuss the project," not "discuss about the project." This error is common because "talk about" uses a preposition, but "discuss" does not.'
  },
  {
    category: 'english',
    topic: 'Common Mistakes',
    difficulty: 3,
    qtype: 'mcq',
    text: 'Choose the correct sentence:',
    options: [
      'A) There are less students in this batch.',
      'B) There are fewer students in this batch.',
      'C) There is fewer students in this batch.',
      'D) There are less student in this batch.'
    ],
    correctAnswer: 'There are fewer students in this batch.',
    explanation: '"Fewer" is used with countable nouns such as "students," while "less" is used with uncountable nouns such as "water" or "time." The plural countable "students" needs "fewer" and the plural verb "are." This rule is frequently tested in placement interviews.'
  }
];