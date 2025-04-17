import OpenAI from "openai";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import removeMd from "remove-markdown";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export const generateCV = async (oldCV: string, jobDes: string) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert resume writer. Your task is to analyze, edit, and generate a resume optimized for ATS (Applicant Tracking Systems) and recruiters. Ensure proper formatting, keyword usage, and alignment with the given job description. Only return the final formatted resume in markdown format without commentary, explanations, or summaries. Do not include any extra text before or after the resume. If any links are included (e.g. portfolio, LinkedIn, GitHub, or project URLs), make sure they are properly formatted as markdown hyperlinks like [LinkedIn](https://linkedin.com/in/yourname).`
        },
        {
          role: "user",
          content: `Here is my current resume:\n${oldCV}\n\nHere is the job description:\n${jobDes}\n\nPlease optimize my resume accordingly.`
        }
      ]
    });

    let message = completion.choices[0].message.content ?? "";
    const resumeMatch = message.match(/---\n([\s\S]*?)\n---/g);

    if (resumeMatch) {
      const header = message.split('---')[0].trim();
      const content = resumeMatch.map(section => section.replace(/---/g, '').trim()).join('\n\n');
      message = `${header}\n\n${content}`;
    }

    return removeMd(message);
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};

const wrapText = (text: string, font: PDFFont, fontSize: number, maxWidth: number) => {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];
  
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine + ' ' + word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    
    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  
  lines.push(currentLine);
  return lines;
};


const checkNewPage = (currentY: number, minY: number, pdfDoc: PDFDocument, currentPage: PDFPage) => {
  if (currentY < minY) {
    currentPage = pdfDoc.addPage([612, 792]);
    return { newPage: currentPage, newY: currentPage.getSize().height - 60 };
  }
  return { newPage: currentPage, newY: currentY };
};

export const createPDF = async (text: string): Promise<Uint8Array> => {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);

    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const margin = {
      top: 60,
      bottom: 50,
      left: 50,
      right: 50,
    };

    const contentWidth = width - margin.left - margin.right;

    const fontSize = {
      name: 16,
      title: 10,
      section: 10,
      subsection: 9,
      body: 7,
      small: 7,
    };

    const lineHeight = {
      name: 20,
      title: 16,
      section: 16,
      subsection: 14,
      body: 12,
      small: 10,
      gap: 12
    };

    const colors = {
      name: rgb(0.651, 0.110, 0.000),
      section: rgb(0.024, 0.553, 0.616),
      body: rgb(0, 0, 0),
    };

    const sectionSpacing = 20;
    const itemSpacing = 10;

    const sections = parseResumeContent(text);

    let currentY = height - margin.top;
    let currentPage = page;

    if (sections.header) {
      const nameParts = sections.header.name.split(' ');
      currentPage.drawText(nameParts.join(' ').toUpperCase(), {
        x: margin.left,
        y: currentY,
        size: fontSize.name,
        font: boldFont,
        color: colors.name,
      });
      currentY -= lineHeight.name;

      if (sections.header.title) {
        currentPage.drawText(sections.header.title, {
          x: margin.left,
          y: currentY,
          size: fontSize.title,
          font: boldFont,
          color: colors.section,
        });
        currentY -= lineHeight.title;
      }

      if (sections.header.contact) {
        const contactLines = formatContactInfo(sections.header.contact);
        for (const line of contactLines) {
          currentPage.drawText(line, {
            x: margin.left,
            y: currentY,
            size: fontSize.small,
            font: font,
            color: colors.body,
          });
          currentY -= lineHeight.small;
          currentY -= 12;
        }
      }
    }

    for (const [sectionName, sectionContent] of Object.entries(sections.content)) {
      const pageCheck = checkNewPage(currentY, margin.bottom + 50, pdfDoc, currentPage);
      currentPage = pageCheck.newPage;
      currentY = pageCheck.newY;

      currentPage.drawText(sectionName.toUpperCase(), {
        x: margin.left,
        y: currentY,
        size: fontSize.section,
        font: boldFont,
        color: colors.section,
      });
      currentY -= lineHeight.section;
      currentY -= 8;

      if (sectionName.toLowerCase().includes('summary')) {
        const summaryLines = wrapText(sectionContent.text, font, fontSize.body, contentWidth);
        for (const line of summaryLines) {
          const pageCheck = checkNewPage(currentY, margin.bottom, pdfDoc, currentPage);
          currentPage = pageCheck.newPage;
          currentY = pageCheck.newY;
          
          currentPage.drawText(line, {
            x: margin.left,
            y: currentY,
            size: fontSize.body,
            font: font,
            color: colors.body,
          });
          currentY -= lineHeight.body;
        }
      } else if (sectionName.toLowerCase().includes('skills')) {
        if (sectionContent.categories) {
          for (const [category, skills] of Object.entries(sectionContent.categories)) {
            const pageCheck = checkNewPage(currentY, margin.bottom, pdfDoc, currentPage);
            currentPage = pageCheck.newPage;
            currentY = pageCheck.newY;
            
            currentPage.drawText(`${category}: `, {
              x: margin.left,
              y: currentY,
              size: fontSize.subsection,
              font: boldFont,
              color: colors.body,
            });

            const categoryWidth = boldFont.widthOfTextAtSize(`${category}: `, fontSize.subsection);
            const skillText = skills.join(', ');
            
            const skillLines = wrapText(skillText, font, fontSize.body, contentWidth - categoryWidth);

            if (skillLines.length > 0) {
              currentPage.drawText(skillLines[0], {
                x: margin.left + categoryWidth,
                y: currentY,
                size: fontSize.body,
                font: font,
                color: colors.body,
              });
              currentY -= lineHeight.body;
            }

            for (let i = 1; i < skillLines.length; i++) {
              const pageCheck = checkNewPage(currentY, margin.bottom, pdfDoc, currentPage);
              currentPage = pageCheck.newPage;
              currentY = pageCheck.newY;

              currentPage.drawText(skillLines[i], {
                x: margin.left + categoryWidth,
                y: currentY,
                size: fontSize.body,
                font: font,
                color: colors.body,
              });
              currentY -= lineHeight.body;
            }
            
            currentY -= itemSpacing/2;
          }

          // -------DONE------

        } else if (sectionContent.list) {
          const skillText = sectionContent.list.join(', ');
          const skillLines = wrapText(skillText, font, fontSize.body, contentWidth);
          
          for (const line of skillLines) {
            const pageCheck = checkNewPage(currentY, margin.bottom, pdfDoc, currentPage);
            currentPage = pageCheck.newPage;
            currentY = pageCheck.newY;
            
            currentPage.drawText(line, {
              x: margin.left,
              y: currentY,
              size: fontSize.body,
              font: font,
              color: colors.body,
            });
            currentY -= lineHeight.body;
          }
        }
      } else if (sectionName.toLowerCase().includes('experience') || 
                 sectionName.toLowerCase().includes('project') ||
                 sectionName.toLowerCase().includes('education')) {

        if (sectionContent.entries) {
          for (const entry of sectionContent.entries) {
            const pageCheck = checkNewPage(currentY, margin.bottom, pdfDoc, currentPage);
            currentPage = pageCheck.newPage;
            currentY = pageCheck.newY;

            if (entry.title && entry.organization) {
              const titleText = `${entry.title}${entry.organization ? ' - ' + entry.organization : ''}`;
              currentPage.drawText(titleText, {
                x: margin.left,
                y: currentY,
                size: fontSize.body,
                font: boldFont,
                color: colors.body,
              });
            } else if (entry.title) {
              currentPage.drawText(entry.title, {
                x: margin.left,
                y: currentY,
                size: fontSize.subsection,
                font: boldFont,
                color: colors.subsection,
              });
            }
            
            // Date/Location on the right
            if (entry.date) {
              const dateText = entry.date;
              const dateWidth = font.widthOfTextAtSize(dateText, fontSize.small);
              currentPage.drawText(dateText, {
                x: width - margin.right - dateWidth,
                y: currentY,
                size: fontSize.small,
                font: italicFont,
                color: colors.dates,
              });
            }
            
            currentY -= lineHeight.subsection;
            
            // Location if available
            if (entry.location) {
              const locationText = entry.location;
              currentPage.drawText(locationText, {
                x: margin.left,
                y: currentY,
                size: fontSize.small,
                font: italicFont,
                color: colors.dates,
              });
              currentY -= lineHeight.small;
            }
            
            // Description paragraphs
            if (entry.description) {
              for (const paragraph of entry.description) {
                const lines = wrapText(paragraph, font, fontSize.body, contentWidth);
                for (let line of lines) {
                  // Check if we need a new page
                  const pageCheck = checkNewPage(currentY, margin.bottom, pdfDoc, currentPage);
                  currentPage = pageCheck.newPage;
                  currentY = pageCheck.newY;
                  
                  currentPage.drawText(line, {
                    x: margin.left,
                    y: currentY,
                    size: fontSize.body,
                    font: font,
                    color: colors.body,
                  });
                  currentY -= lineHeight.body;
                }
                currentY -= 2; // Small gap between paragraphs
              }
            }
            
            // Bullet points
            if (entry.bullets) {
              for (const bullet of entry.bullets) {
                const bulletLines = wrapText(bullet, font, fontSize.body, contentWidth - 15);
                // Draw bullet
                currentPage.drawText('•', {
                  x: margin.left,
                  y: currentY,
                  size: fontSize.body,
                  font: font,
                  color: colors.body,
                });
                
                // Draw first line of bullet point text
                if (bulletLines.length > 0) {
                  currentPage.drawText(bulletLines[0], {
                    x: margin.left + 15,
                    y: currentY,
                    size: fontSize.body,
                    font: font,
                    color: colors.body,
                  });
                  currentY -= lineHeight.body;
                }
                
                // Draw remaining lines with proper indentation
                for (let i = 1; i < bulletLines.length; i++) {
                  // Check if we need a new page
                  const pageCheck = checkNewPage(currentY, margin.bottom, pdfDoc, currentPage);
                  currentPage = pageCheck.newPage;
                  currentY = pageCheck.newY;
                  
                  currentPage.drawText(bulletLines[i], {
                    x: margin.left + 15,
                    y: currentY,
                    size: fontSize.body,
                    font: font,
                    color: colors.body,
                  });
                  currentY -= lineHeight.body;
                }
              }
            }
            
            // Draw technologies/tools if available
            if (entry.technologies) {
              // Check if we need a new page
              const pageCheck = checkNewPage(currentY, margin.bottom, pdfDoc, currentPage);
              currentPage = pageCheck.newPage;
              currentY = pageCheck.newY;
              
              const techText = `Technologies: ${entry.technologies}`;
              const techLines = wrapText(techText, italicFont, fontSize.small, contentWidth);
              
              for (let line of techLines) {
                currentPage.drawText(line, {
                  x: margin.left,
                  y: currentY,
                  size: fontSize.small,
                  font: italicFont,
                  color: colors.body,
                });
                currentY -= lineHeight.small;
              }
            }
            
            // Add spacing between entries
            currentY -= itemSpacing;
          }
        }
      }
      
      // Add spacing between sections
      currentY -= sectionSpacing;
    }

    // Add page numbers
    const totalPages = pdfDoc.getPageCount();
    for (let i = 0; i < totalPages; i++) {
      const page = pdfDoc.getPage(i);
      const { height } = page.getSize();
      page.drawText(`Page ${i + 1} of ${totalPages}`, {
        x: width / 2 - 30,
        y: margin.bottom / 2,
        size: 8,
        font: font,
        color: rgb(0.6, 0.6, 0.6),
      });
    }

    return await pdfDoc.save();
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

const parseResumeContent = (text: string) => {
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  const resume = {
    header: {
      name: '',
      title: '',
      contact: ''
    },
    content: {}
  };

  if (lines.length > 0) {
    resume.header.name = lines[0];
    
    if (lines.length > 1) {
      resume.header.title = lines[1];

      let contactLines = [];
      let i = 2;
      while (i < lines.length && !lines[i].includes(':') && !lines[i].toUpperCase().match(/^[A-Z ]+$/)) {
        contactLines.push(lines[i]);
        i++;
      }

      resume.header.contact = contactLines.join(' | ');

      let currentSection = '';
      let currentEntry = null;

      for (; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.toUpperCase() === line && line.length > 2 || line.endsWith(':')) {
          currentSection = line.replace(':', '').trim();
          resume.content[currentSection] = {
            entries: []
          };
          currentEntry = null;
        } 
        // New entry for Experience/Education/Projects - detect by looking for " - " separator
        else if (line.includes(' - ') || (currentSection && line.match(/^[A-Za-z]/) && !line.startsWith('•'))) {
          if (currentSection.toLowerCase().includes('experience') || 
              currentSection.toLowerCase().includes('education') ||
              currentSection.toLowerCase().includes('project')) {
            
            if (currentEntry) {
              resume.content[currentSection].entries.push(currentEntry);
            }
            
            currentEntry = { title: '', organization: '', date:'', location: '', technologies: '', description: [], bullets: [] };

            if (line.includes(' - ')) {
              const parts = line.split(' - ');
              currentEntry.title = parts[0].trim();
              if (parts[1].includes('|')) {
                const subParts = parts[1].split('|');
                currentEntry.organization = subParts[0].trim();
                currentEntry.date = subParts[1].trim();
              } else {
                currentEntry.organization = parts[1].trim();
              }
            } else {
              currentEntry.title = line;
            }
          } else if (currentSection.toLowerCase().includes('skills')) {
            if (!resume.content[currentSection].categories) {
              resume.content[currentSection].categories = {};
            }
            
            const parts = line.split(':');
            if (parts.length > 1) {
              const category = parts[0].trim();
              const skills = parts[1].split(',').map(skill => skill.trim());
              resume.content[currentSection].categories[category] = skills;
            } else {
              if (!resume.content[currentSection].list) {
                resume.content[currentSection].list = [];
              }
              resume.content[currentSection].list.push(line);
            }
          } else if (currentSection.toLowerCase().includes('summary')) {
            resume.content[currentSection].text = line;
          }
        } 
        else if (currentEntry && line.match(/^[A-Za-z]+ [0-9]{4}|[A-Za-z]+ - [A-Za-z]+|Remote/i)) {
          if (line.match(/^[A-Za-z]+ [0-9]{4}/)) {
            currentEntry.date = line;
          } else {
            currentEntry.location = line;
          }
        }
        else if (line.startsWith('•') || line.startsWith('-')) {
          if (currentEntry) {
            if (!currentEntry.bullets) {
              currentEntry.bullets = [];
            }
            currentEntry.bullets.push(line.substring(1).trim());
          }
        }
        else if (currentEntry && line.toLowerCase().startsWith('built with') || line.toLowerCase().startsWith('technologies')) {
          currentEntry.technologies = line;
        }
        else if (currentEntry) {
          if (!currentEntry.description) {
            currentEntry.description = [];
          }
          currentEntry.description.push(line);
        }
        else if (currentSection && currentSection.toLowerCase().includes('summary')) {
          if (!resume.content[currentSection].text) {
            resume.content[currentSection].text = line;
          } else {
            resume.content[currentSection].text += ' ' + line;
          }
        }
      }
      if (currentEntry && currentSection) {
        if (!resume.content[currentSection].entries) {
          resume.content[currentSection].entries = [];
        }
        resume.content[currentSection].entries.push(currentEntry);
      }
    }
  }
  
  return resume;
}

const  formatContactInfo = (contactText: string) => {
  const items = contactText.split('|').map(item => item.trim());

  const lines = [];
  const currentLine = [];
  
  for (const item of items) {
    currentLine.push(item);
    if (currentLine.length === 6) {
      lines.push(currentLine.join(' | '));
      currentLine = [];
    }
  }
  
  if (currentLine.length > 0) {
    lines.push(currentLine.join(' | '));
  }
  
  return lines;
}

export const downloadPDF = (pdfBytes: Uint8Array, filename = "Tisloh_Pam_CV.pdf") => {
  try {
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading PDF:", error);
    throw error;
  }
};