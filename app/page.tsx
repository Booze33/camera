'use client'

import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useState } from 'react'
import { generateCV } from "@/lib/config"

export default function Home() {
  const [oldCV, setOldCV] = useState('')
  const [jobDes, setJobDes] = useState('')
  const [cv, setCV] = useState('')

  const handleGenerate = async () => {
    try {
      if (!oldCV || !jobDes) {
        throw new Error('Please enter both old CV and job description')
      }
      const message = await generateCV(oldCV, jobDes)

      if (message) {
        setCV(message)
      }
    } catch (error) {
      console.error("Error generating CV:", error)
    }
  }

  return (
    <div className="w-full h-screen flex flex-row justify-center items-center">
      <div className="w-1/2 max-w-2xl h-4/5 px-4">
        <Textarea
          placeholder="Enter current CV"
          className="mb-4 w-full h-40"
          value={oldCV}
          onChange={(e) => setOldCV(e.target.value)}
        />
        <Textarea
          placeholder="Enter job description"
          className="mb-4 w-full h-32"
          value={jobDes}
          onChange={(e) => setJobDes(e.target.value)}
        />
        <Button 
          variant="outline" 
          onClick={handleGenerate}
          disabled={!oldCV || !jobDes}
        >
          Generate CV
        </Button>
      </div>
      <div className="w-1/3 h-4/5 border-l-2 p-4 overflow-auto">
        {cv ? (
          <div className="whitespace-pre-wrap">{cv}</div>
        ) : (
          <p className="text-gray-400">Generated CV will appear here</p>
        )}
      </div>
    </div>
  );
}