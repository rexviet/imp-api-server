
import { PrismaClient, SectionType, TestDifficulty } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding IELTS Mock Tests ---');
  // Clean order to avoid FK issues
  await prisma.gradingRequest.deleteMany();
  await prisma.userAttempt.deleteMany();
  await prisma.question.deleteMany();
  await prisma.testSection.deleteMany();
  await prisma.mockTest.deleteMany();

  // 1. IELTS Academic Test 1
  const test1 = await prisma.mockTest.create({
    data: {
      title: 'IELTS Academic Practice Test 1',
      description: 'Full simulation of Academic IELTS with various question types.',
      difficulty: TestDifficulty.ACADEMIC,
      sections: {
        create: [
          // LISTENING SECTION
          {
            type: SectionType.LISTENING,
            order: 1,
            questions: {
              create: [
                {
                  order: 1,
                  content: {
                    type: 'multiple_choice',
                    text: 'What is the main topic of the lecture?',
                    options: ['Economic history', 'Marine biology', 'Ancient architecture', 'Modern art'],
                    audioUrl: 'https://ieltstrainingonline.com/wp-content/uploads/2021/07/IELTS-Recent-Actual-Test-With-Answers-Practice-Test-01-Section1.mp3'
                  },
                  answerKey: { value: 'Marine biology' }
                },
                {
                  order: 2,
                  content: {
                    type: 'fill_in_blank',
                    text: 'The speaker mentions that the ______ is the largest mammal on earth.',
                    wordLimit: 3
                  },
                  answerKey: { values: ['blue whale', 'whale'] }
                }
              ]
            }
          },
          // READING SECTION
          {
            type: SectionType.READING,
            order: 2,
            questions: {
              create: [
                {
                  order: 1,
                  content: {
                    type: 'true_false_notgiven',
                    text: 'The research was funded by the local government.',
                    passage: 'The study was entirely supported by private donations from several international environmental groups...'
                  },
                  answerKey: { value: 'FALSE' }
                },
                {
                  order: 2,
                  content: {
                    type: 'matching_headings',
                    text: 'Match the heading to Paragraph A',
                    options: ['The rise of technology', 'Urban planning challenges', 'A history of nomadic tribes', 'Future of transportation']
                  },
                  answerKey: { value: 'Urban planning challenges' }
                }
              ]
            }
          },
          // WRITING SECTION
          {
            type: SectionType.WRITING,
            order: 3,
            questions: {
              create: [
                {
                  order: 1,
                  content: {
                    type: 'essay',
                    text: 'Some people think that it is best to work in the same organization for one\'s whole life. Others think that it is better to change jobs frequently. Discuss both views and give your opinion.',
                    wordLimit: 250
                  }
                }
              ]
            }
          }
        ]
      }
    }
  });

  // 2. IELTS General Test 1
  const test2 = await prisma.mockTest.create({
    data: {
      title: 'IELTS General Training Pack 1',
      description: 'Focuses on workplace and everyday social situations.',
      difficulty: TestDifficulty.GENERAL,
      sections: {
        create: [
          {
            type: SectionType.READING,
            order: 1,
            questions: {
              create: [
                {
                  order: 1,
                  content: {
                    type: 'yes_no_notgiven',
                    text: 'You can apply for the job via email.',
                    passage: 'Interested candidates should submit their physical applications to the HR department on the 3rd floor. Digital submissions are not accepted at this stage.'
                  },
                  answerKey: { value: 'NO' }
                }
              ]
            }
          }
        ]
      }
    }
  });

  // 3. IELTS Listening Booster
  const test3 = await prisma.mockTest.create({
    data: {
      title: 'IELTS Listening Booster - Map & Diagrams',
      description: 'Specialized practice for labeling maps and diagrams in Listening Part 2.',
      difficulty: TestDifficulty.ACADEMIC,
      sections: {
        create: [
          {
            type: SectionType.LISTENING,
            order: 1,
            questions: {
              create: [
                {
                  order: 1,
                  content: {
                    type: 'multiple_choice',
                    text: 'Where is the new library located?',
                    options: ['Near the park', 'Behind the gym', 'Opposite the station', 'Next to the cafe'],
                    audioUrl: 'https://ieltstrainingonline.com/wp-content/uploads/2021/07/IELTS-Recent-Actual-Test-With-Answers-Practice-Test-01-Section2.mp3',
                    imageUrl: 'https://www.ielts-exam.net/images/listening/ielts-listening-sample-map.png'
                  },
                  answerKey: { value: 'Opposite the station' }
                },
                {
                  order: 2,
                  content: {
                    type: 'fill_in_blank',
                    text: 'Label (A) on the map is the ______ area.',
                    imageUrl: 'https://storage.googleapis.com/ielts-master-assets/sample_map.png'
                  },
                  answerKey: { values: ['reception', 'waiting room'] }
                }
              ]
            }
          }
        ]
      }
    }
  });

  // 4. IELTS Ultimate Full Mock Test (4 Skills)
  const test4 = await prisma.mockTest.create({
    data: {
      title: 'IELTS Ultimate Full Mock Test',
      description: 'The complete IELTS experience: Listening, Reading, Writing, and Speaking.',
      difficulty: TestDifficulty.ACADEMIC,
      sections: {
        create: [
          // 1. Listening
          {
            type: SectionType.LISTENING,
            order: 1,
            questions: {
              create: [
                {
                  order: 1,
                  content: {
                    type: 'multiple_choice',
                    text: 'When is the next available appointment?',
                    options: ['Tuesday morning', 'Wednesday afternoon', 'Thursday evening', 'Friday morning'],
                    audioUrl: 'https://ieltstrainingonline.com/wp-content/uploads/2021/07/IELTS-Recent-Actual-Test-With-Answers-Practice-Test-01-Section3.mp3'
                  },
                  answerKey: { value: 'Wednesday afternoon' }
                }
              ]
            }
          },
          // 2. Reading
          {
            type: SectionType.READING,
            order: 2,
            questions: {
              create: [
                {
                  order: 1,
                  content: {
                    type: 'true_false_notgiven',
                    text: 'Industrialization led to a significant decrease in rural population.',
                    passage: 'The Industrial Revolution transformed societies by creating factory jobs in cities, drawing millions away from small villages and farming communities.'
                  },
                  answerKey: { value: 'TRUE' }
                }
              ]
            }
          },
          // 3. Writing
          {
            type: SectionType.WRITING,
            order: 3,
            questions: {
              create: [
                {
                  order: 1,
                  content: {
                    type: 'essay',
                    text: 'Write a response to: Summarize the information shown in the graph below.',
                    imageUrl: 'https://storage.googleapis.com/ielts-master-assets/writing_task_1_chart.png',
                    wordLimit: 150
                  }
                },
                {
                  order: 2,
                  content: {
                    type: 'essay',
                    text: 'Nowadays, more and more people are using social media as a primary source of news. Do the advantages outweigh the disadvantages?',
                    wordLimit: 250
                  }
                }
              ]
            }
          },
          // 4. Speaking
          {
            type: SectionType.SPEAKING,
            order: 4,
            questions: {
              create: [
                {
                  order: 1,
                  content: {
                    type: 'short_answer', // Use short_answer as placeholder for Speaking Part 1 questions
                    text: 'Speaking Part 1: Let\'s talk about your hometown. Where is it located and what do you like most about it?'
                  }
                },
                {
                  order: 2,
                  content: {
                    type: 'essay', // Using essay type to show the Cue Card text
                    text: 'Speaking Part 2 (Cue Card): Describe a person you admire. You should say: Who they are, When you first met them, What they are like, and Explain why you admire them so much.'
                  }
                },
                {
                  order: 3,
                  content: {
                    type: 'short_answer',
                    text: 'Speaking Part 3: Why do you think some people become famous role models for young children?'
                  }
                }
              ]
            }
          }
        ]
      }
    }
  });

  // 5. Cambridge IELTS 18 - Academic Test 1 (FULL 4-SKILL CONTENT)
  const test5 = await prisma.mockTest.create({
    data: {
      title: 'Cambridge IELTS 18 - Academic Test 1',
      description: 'Official Cambridge 18 Practice Test. Full 4 sections with real audio, passages, and prompts.',
      difficulty: TestDifficulty.ACADEMIC,
      sections: {
        create: [
          // 1. LISTENING SECTION
          {
            type: SectionType.LISTENING,
            order: 1,
            questions: {
              create: [
                // Part 1: Transport Survey
                {
                  order: 1,
                  content: {
                    type: 'fill_in_blank',
                    text: 'Name: Sadie Jones. Year of birth: ______',
                    audioUrl: 'https://ieltstrainingonline.com/wp-content/uploads/2023/06/cam18-test1-part1.mp3'
                  },
                  answerKey: { value: '1991' }
                },
                {
                  order: 2,
                  content: {
                    type: 'fill_in_blank',
                    text: 'Postcode: ______',
                    audioUrl: 'https://ieltstrainingonline.com/wp-content/uploads/2023/06/cam18-test1-part1.mp3'
                  },
                  answerKey: { value: 'DW30 7YZ' }
                },
                // Part 2: Volunteer ACE
                {
                  order: 11,
                  content: {
                    type: 'multiple_choice',
                    text: 'Why does the speaker apologize for the lack of seats?',
                    options: ['The room is smaller than expected', 'More people arrived than were invited', 'Some chairs have been moved'],
                    audioUrl: 'https://ieltstrainingonline.com/wp-content/uploads/2023/06/cam18-test1-part2.mp3'
                  },
                  answerKey: { value: 'More people arrived than were invited' }
                },
                // Part 4: Elephant Translocation
                {
                  order: 31,
                  content: {
                    type: 'fill_in_blank',
                    text: 'Reasons for elephant overpopulation: damage to ______ and loss of biodiversity.',
                    audioUrl: 'https://ieltstrainingonline.com/wp-content/uploads/2023/06/cam18-test1-part4.mp3'
                  },
                  answerKey: { value: 'habitats' }
                }
              ]
            }
          },
          // 2. READING SECTION
          {
            type: SectionType.READING,
            order: 2,
            questions: {
              create: [
                // Passage 1: Urban Farming
                {
                  order: 1,
                  content: {
                    type: 'fill_in_blank',
                    passage: 'Urban Farming in Paris. ... Strawberries that are small, intensely flavoured and resplendently red sprout abundantly from large plastic tubes...',
                    text: 'Vertical tubes are used to grow strawberries, ______ and herbs.'
                  },
                  answerKey: { values: ['lettuces', 'lettuce'] }
                },
                // Passage 2: Forest Management
                {
                  order: 22,
                  content: {
                    type: 'fill_in_blank',
                    passage: 'Forest Management in Pennsylvania. ... Managing low-quality wood for bioenergy...',
                    text: 'Trees left behind in a TSI cut provide more ______ for wildlife.'
                  },
                  answerKey: { value: 'cover' }
                }
              ]
            }
          },
          // 3. WRITING SECTION
          {
            type: SectionType.WRITING,
            order: 3,
            questions: {
              create: [
                {
                  order: 1,
                  content: {
                    type: 'essay',
                    text: 'Writing Task 1: The line graph shows the percentage of the population in four Asian countries living in cities from 1970 to 2020, with predictions for 2030 and 2040.',
                    imageUrl: 'https://zim.vn/media/6486/image8-min.png'
                  },
                  answerKey: { value: 'N/A' } // Writing is AI graded
                },
                {
                  order: 2,
                  content: {
                    type: 'essay',
                    text: 'Writing Task 2: The most important aim of science should be to improve people\'s lives. To what extent do you agree or disagree with this statement?'
                  },
                  answerKey: { value: 'N/A' }
                }
              ]
            }
          },
          // 4. SPEAKING SECTION
          {
            type: SectionType.SPEAKING,
            order: 4,
            questions: {
              create: [
                {
                  order: 1,
                  content: {
                    type: 'speaking',
                    text: 'Part 1 Interview: Let\'s talk about paying bills. What kinds of bills do you have to pay?'
                  },
                  answerKey: { value: 'N/A' }
                },
                {
                  order: 2,
                  content: {
                    type: 'speaking',
                    text: 'Part 2 Cue Card: Describe some food or drink that you learned to prepare. You should say: What it was, When and where you learned it, How you learned it, and How you felt about it.'
                  },
                  answerKey: { value: 'N/A' }
                }
              ]
            }
          }
        ]
      }
    }
  });

  console.log(`Successfully seeded: ${test1.title}, ${test2.title}, ${test3.title}, ${test4.title}, and ${test5.title}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
