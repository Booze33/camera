import OpenAI from "openai";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import removeMd from "remove-markdown";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
})

export const generateCV = async (oldCV: string, jobDes: string) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert resume writer. Your task is to analyze, edit, and generate a resume optimized for ATS (Applicant Tracking Systems) and recruiters. Ensure proper formatting, keyword usage, and alignment with the given job description. Also You are an expert resume writer. Only return the final formatted resume in markdown format without commentary, explanations, or summaries. Do not include any extra text before or after the resume. Additionally display the link properly"
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

// Helper function to wrap text
const wrapText = (text, font, fontSize, maxWidth) => {
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

// Helper function to process URLs in text
const processLinksInText = (text) => {
  // Match URLs starting with http://, https://, or www.
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    // Ensure URL has proper protocol
    if (url.startsWith('www.')) {
      return 'https://' + url;
    }
    return url;
  });
};

export const createPDF = async (text: string): Promise<Uint8Array> => {
  try {
    const pdfDoc = await PDFDocument.create();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

    let page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();

    const margin = {
      top: 60,
      bottom: 50,
      left: 60,
      right: 60
    };

    const fontSize = {
      name: 16,
      section: 12,
      subsection: 11,
      body: 9,
      small: 8
    };

    const lineHeight = {
      name: 20,
      section: 18,
      subsection: 14,
      body: 12,
      small: 10,
      gap: 8
    };

    const colors = {
      primary: rgb(0.1, 0.1, 0.4),
      secondary: rgb(0.3, 0.3, 0.6),
      body: rgb(0.1, 0.1, 0.1),
      subtle: rgb(0.4, 0.4, 0.4),
      link: rgb(0, 0.3, 0.8)
    };

    const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '');
    
    // Start position
    let y = height - margin.top;
    let currentY = y;
    let currentPage = page;
    let pageNumber = 1;

    if (lines.length > 0) {
      currentPage.drawText(lines[0], {
        x: margin.left,
        y: currentY,
        size: fontSize.name,
        font: fontBold,
        color: colors.primary
      });
      currentY -= lineHeight.name;

      if (lines.length > 1 && !lines[1].includes('@') && !lines[1].includes('|')) {
        currentPage.drawText(lines[1], {
          x: margin.left,
          y: currentY,
          size: fontSize.subsection,
          font: fontBold,
          color: colors.secondary
        });
        currentY -= lineHeight.subsection;
      }

      let contactLines = [];
      let lineIndex = 1;

      if (lines.length > 1 && !lines[1].includes('@') && !lines[1].includes('|')) {
        lineIndex = 2;
      }
      
      while (lineIndex < Math.min(5, lines.length) && 
            (lines[lineIndex].includes('@') || 
             lines[lineIndex].includes('|') || 
             lines[lineIndex].includes('-') || 
             lines[lineIndex].includes('(') || 
             lines[lineIndex].includes('http'))) {
        contactLines.push(lines[lineIndex]);
        lineIndex++;
      }

      if (contactLines.length > 0) {
        for (let i = 0; i < contactLines.length; i++) {
          // Process contact information to properly format links
          const contactLine = contactLines[i];
          const segments = contactLine.split('|').map(segment => segment.trim());
          
          let xOffset = margin.left;
          
          for (let j = 0; j < segments.length; j++) {
            let segment = segments[j];
            
            // Process URLs in the segment
            const processedSegment = processLinksInText(segment);
            const hasLink = segment.includes('http') || 
                            segment.includes('www.') || 
                            segment.includes('@') ||
                            segment.toLowerCase().includes('github') ||
                            segment.toLowerCase().includes('linkedin');
            
            // Draw the segment
            currentPage.drawText(processedSegment, {
              x: xOffset,
              y: currentY,
              size: fontSize.body,
              font: hasLink ? fontItalic : fontRegular,
              color: hasLink ? colors.link : colors.subtle
            });
            
            const segmentWidth = fontRegular.widthOfTextAtSize(processedSegment, fontSize.body);
            xOffset += segmentWidth;
            
            // Add separator if not the last segment
            if (j < segments.length - 1) {
              currentPage.drawText(' | ', {
                x: xOffset,
                y: currentY,
                size: fontSize.body,
                font: fontRegular,
                color: colors.subtle
              });
              xOffset += fontRegular.widthOfTextAtSize(' | ', fontSize.body);
            }
          }
          
          currentY -= lineHeight.body;
        }
        currentY -= lineHeight.gap / 2;
      }

      currentPage.drawLine({
        start: { x: margin.left, y: currentY },
        end: { x: width - margin.right, y: currentY },
        thickness: 1,
        color: colors.secondary
      });
      
      currentY -= lineHeight.gap;

      for (let i = lineIndex; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes('Page') && line.includes('of')) {
          continue;
        }

        if (currentY < margin.bottom + 20) {
          pageNumber++;
          currentPage = pdfDoc.addPage([612, 792]);
          currentY = height - margin.top;
        }

        const maxWidth = width - margin.left - margin.right - (line.startsWith('•') ? 15 : 0);

        if (line === line.toUpperCase() && line.length > 3 && line.length < 30) {
          // Section header
          currentY -= lineHeight.gap / 2;
          
          currentPage.drawText(line, {
            x: margin.left,
            y: currentY,
            size: fontSize.section,
            font: fontBold,
            color: colors.primary
          });
          
          currentY -= lineHeight.section;

          currentPage.drawLine({
            start: { x: margin.left, y: currentY + 4 },
            end: { x: width - margin.right, y: currentY + 4 },
            thickness: 0.5,
            color: colors.secondary
          });
          
          currentY -= lineHeight.gap / 2;
        } 

        else if (line.includes(' — ') || line.includes(' - ')) {
          // Handle subsection titles with potential wrapping
          const wrappedLines = wrapText(line, fontBold, fontSize.subsection, maxWidth);
          
          for (let j = 0; j < wrappedLines.length; j++) {
            currentPage.drawText(wrappedLines[j], {
              x: margin.left,
              y: currentY,
              size: fontSize.subsection,
              font: fontBold,
              color: colors.secondary
            });
            
            currentY -= lineHeight.subsection;
            
            if (currentY < margin.bottom + 20 && j < wrappedLines.length - 1) {
              pageNumber++;
              currentPage = pdfDoc.addPage([612, 792]);
              currentY = height - margin.top;
            }
          }
        }

        else if (line.startsWith('•')) {
          // Bullet points with wrapping
          const indentation = 10;
          const wrappedLines = wrapText(line, fontRegular, fontSize.body, maxWidth - indentation);
          
          for (let j = 0; j < wrappedLines.length; j++) {
            currentPage.drawText(j === 0 ? wrappedLines[j] : `  ${wrappedLines[j]}`, {
              x: margin.left + (j === 0 ? indentation : indentation * 1.5),
              y: currentY,
              size: fontSize.body,
              font: fontRegular,
              color: colors.body
            });
            
            currentY -= lineHeight.body;
            
            if (currentY < margin.bottom + 20 && j < wrappedLines.length - 1) {
              pageNumber++;
              currentPage = pdfDoc.addPage([612, 792]);
              currentY = height - margin.top;
            }
          }
        }

        else if (line.includes(':')) {
          const parts = line.split(':');
          if (parts.length === 2) {
            const category = parts[0].trim();
            const values = parts[1].trim();

            currentPage.drawText(category + ':', {
              x: margin.left,
              y: currentY,
              size: fontSize.body,
              font: fontBold,
              color: colors.body
            });

            const categoryWidth = fontBold.widthOfTextAtSize(category + ':', fontSize.body);
            
            // Check if we need to wrap the values
            const availableWidth = maxWidth - categoryWidth;
            const wrappedValues = wrapText(' ' + values, fontRegular, fontSize.body, availableWidth);
            
            for (let j = 0; j < wrappedValues.length; j++) {
              const xOffset = j === 0 ? margin.left + categoryWidth : margin.left + categoryWidth + 5;
              
              currentPage.drawText(wrappedValues[j], {
                x: xOffset,
                y: currentY - (j > 0 ? lineHeight.body * j : 0),
                size: fontSize.body,
                font: fontRegular,
                color: colors.body
              });
              
              if (j > 0) currentY -= lineHeight.body;
              
              if (currentY < margin.bottom + 20 && j < wrappedValues.length - 1) {
                pageNumber++;
                currentPage = pdfDoc.addPage([612, 792]);
                currentY = height - margin.top;
              }
            }
            
            currentY -= lineHeight.body;
          } else {
            // Handle multi-colon text with wrapping
            const wrappedLines = wrapText(line, fontRegular, fontSize.body, maxWidth);
            
            for (let j = 0; j < wrappedLines.length; j++) {
              currentPage.drawText(wrappedLines[j], {
                x: margin.left,
                y: currentY - (j * lineHeight.body),
                size: fontSize.body,
                font: fontRegular,
                color: colors.body
              });
              
              if (j > 0) currentY -= lineHeight.body;
              
              if (currentY < margin.bottom + 20 && j < wrappedLines.length - 1) {
                pageNumber++;
                currentPage = pdfDoc.addPage([612, 792]);
                currentY = height - margin.top;
              }
            }
            currentY -= lineHeight.body;
          }
        }

        else if (line.includes('(') && line.includes(')')) {
          // Handle parenthetical text with wrapping
          const wrappedLines = wrapText(line, fontItalic, fontSize.small, maxWidth);
          
          for (let j = 0; j < wrappedLines.length; j++) {
            currentPage.drawText(wrappedLines[j], {
              x: margin.left,
              y: currentY - (j * lineHeight.small),
              size: fontSize.small,
              font: fontItalic,
              color: colors.subtle
            });
            
            if (j > 0) currentY -= lineHeight.small;
            
            if (currentY < margin.bottom + 20 && j < wrappedLines.length - 1) {
              pageNumber++;
              currentPage = pdfDoc.addPage([612, 792]);
              currentY = height - margin.top;
            }
          }
          
          currentY -= lineHeight.small;
        }

        else if (line.toLowerCase().includes('github') || 
                line.toLowerCase().includes('demo') || 
                line.toLowerCase().includes('http') || 
                line.toLowerCase().includes('www.')) {
          // Handle links with wrapping
          const processedLine = processLinksInText(line);
          const wrappedLines = wrapText(processedLine, fontItalic, fontSize.small, maxWidth);
          
          for (let j = 0; j < wrappedLines.length; j++) {
            currentPage.drawText(wrappedLines[j], {
              x: margin.left,
              y: currentY - (j * lineHeight.small),
              size: fontSize.small,
              font: fontItalic,
              color: colors.link
            });
            
            if (j > 0) currentY -= lineHeight.small;
            
            if (currentY < margin.bottom + 20 && j < wrappedLines.length - 1) {
              pageNumber++;
              currentPage = pdfDoc.addPage([612, 792]);
              currentY = height - margin.top;
            }
          }
          
          currentY -= lineHeight.small;
        }

        else {
          // Handle regular text with wrapping
          const wrappedLines = wrapText(line, fontRegular, fontSize.body, maxWidth);
          
          for (let j = 0; j < wrappedLines.length; j++) {
            currentPage.drawText(wrappedLines[j], {
              x: margin.left,
              y: currentY - (j * lineHeight.body),
              size: fontSize.body,
              font: fontRegular,
              color: colors.body
            });
            
            if (j > 0) currentY -= lineHeight.body;
            
            if (currentY < margin.bottom + 20 && j < wrappedLines.length - 1) {
              pageNumber++;
              currentPage = pdfDoc.addPage([612, 792]);
              currentY = height - margin.top;
            }
          }
          
          currentY -= lineHeight.body;
        }

        if (i < lines.length - 1 && 
            lines[i+1] === lines[i+1].toUpperCase() && 
            lines[i+1].length > 3 && 
            lines[i+1].length < 30) {
          currentY -= lineHeight.gap / 2;
        }
      }
    }

    const totalPages = pdfDoc.getPageCount();
    for (let i = 0; i < totalPages; i++) {
      const page = pdfDoc.getPage(i);
      const { width, height } = page.getSize();
      page.drawText(`Page ${i + 1} of ${totalPages}`, {
        x: width / 2 - 30,
        y: margin.bottom / 2,
        size: fontSize.small,
        font: fontRegular,
        color: colors.subtle
      });
    }

    // Add document metadata for links
    const linkAnnotations = [];
    // You could add PDF annotations here for clickable links if you want to extend this functionality
    
    return await pdfDoc.save();
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

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