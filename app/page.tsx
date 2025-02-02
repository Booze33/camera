import { Textarea } from "@/components/ui/textarea"

export default function Home() {
  return (
    <div className="w-[100vw] h-[100vh] flex flex-row justify-center items-center">
      <div className="w-[45vw] h-[80vh]">
        <Textarea placeholder="Enter current CV" className="mb-4 w-[40vw] h-[15rem]" />
        <Textarea placeholder="Enter job description" className="mb-4 w-[40vw] h-[12rem]" />
      </div>
      <div className="w-[30vw] h-[80vh] border-l-[2px]"></div>
    </div>
  );
}
