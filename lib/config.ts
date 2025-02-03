import OpenAI from "openai";

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
          content: "You are an expert resume writer. Your task is to analyze, edit, and generate a resume optimized for ATS (Applicant Tracking Systems) and recruiters. Ensure proper formatting, keyword usage, and alignment with the given job description."
        },
        {
          role: "user",
          content: `Here is my current resume:\n${oldCV}\n\nHere is the job description:\n${jobDes}\n\nPlease optimize my resume accordingly.`
        }
      ]
    });

    const message = completion.choices[0].message.content;
    //console.log('Generated CV:', message)

    return message
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
