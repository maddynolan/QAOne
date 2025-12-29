import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import FlowstralWorkflowEditor from '@/components/FlowstralWorkflowEditor/FlowstralWorkflowEditor';
import { Layout } from '@/components/Layout';

export default function FlowstralWorkflowEditorPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId') || undefined;
  const importSource = searchParams.get('import') || undefined;

  return (
    <Layout>
      <div className="h-screen">
        <FlowstralWorkflowEditor 
          sessionId={sessionId}
          importSource={importSource}
          onExport={(workflow) => {
            console.log('Workflow exported:', workflow);
          }}
          onImport={(workflow) => {
            console.log('Workflow imported:', workflow);
          }}
        />
      </div>
    </Layout>
  );
}



