'use client';

import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, ChevronDown, ChevronUp, Cpu, Globe, Wrench } from 'lucide-react';
import type { ToolCallTrace } from '@/services/marine-api';
import type { AppLanguage } from './hero/ask-orca-bar';

export interface AgentStepDisplay {
  agentName: string;
  toolName: string;
  statusText: string;
  durationMs?: number;
  status?: string;
}

const AGENT_MAPPINGS: Record<
  string,
  {
    agentNameEn: string;
    agentNameHi: string;
    toolName: string;
    statusEn: string;
    statusHi: string;
  }
> = {
  // 1. Intent Agent
  'intent_agent:detect_intent': {
    agentNameEn: 'Intent Agent',
    agentNameHi: 'इरादा एजेंट',
    toolName: 'detect_intent',
    statusEn: 'Understanding your request',
    statusHi: 'आपका अनुरोध समझा जा रहा है',
  },
  intent_agent: {
    agentNameEn: 'Intent Agent',
    agentNameHi: 'इरादा एजेंट',
    toolName: 'detect_intent',
    statusEn: 'Understanding your request',
    statusHi: 'आपका अनुरोध समझा जा रहा है',
  },
  'Intent Agent': {
    agentNameEn: 'Intent Agent',
    agentNameHi: 'इरादा एजेंट',
    toolName: 'detect_intent',
    statusEn: 'Understanding your request',
    statusHi: 'आपका अनुरोध समझा जा रहा है',
  },

  // 2. PFZ Agent
  'pfz_agent:find_candidates': {
    agentNameEn: 'PFZ Agent',
    agentNameHi: 'मत्स्य क्षेत्र एजेंट',
    toolName: 'find_candidates',
    statusEn: 'Scanning promising fishing zones',
    statusHi: 'संभावित मत्स्य क्षेत्रों की खोज जारी है',
  },
  'pfz_agent:get_zone_details': {
    agentNameEn: 'PFZ Agent',
    agentNameHi: 'मत्स्य क्षेत्र एजेंट',
    toolName: 'get_zone_details',
    statusEn: 'Scanning promising fishing zones',
    statusHi: 'संभावित मत्स्य क्षेत्रों की खोज जारी है',
  },
  pfz_agent: {
    agentNameEn: 'PFZ Agent',
    agentNameHi: 'मत्स्य क्षेत्र एजेंट',
    toolName: 'find_candidates',
    statusEn: 'Scanning promising fishing zones',
    statusHi: 'संभावित मत्स्य क्षेत्रों की खोज जारी है',
  },

  // 3. Ocean Agent
  'ocean_agent:ocean_snapshot': {
    agentNameEn: 'Ocean Agent',
    agentNameHi: 'समुद्र एजेंट',
    toolName: 'ocean_snapshot',
    statusEn: 'Checking ocean conditions',
    statusHi: 'समुद्र की स्थिति जाँची जा रही है',
  },
  'ocean_agent:conditions_for_location': {
    agentNameEn: 'Ocean Agent',
    agentNameHi: 'समुद्र एजेंट',
    toolName: 'ocean_snapshot',
    statusEn: 'Checking ocean conditions',
    statusHi: 'समुद्र की स्थिति जाँची जा रही है',
  },
  ocean_agent: {
    agentNameEn: 'Ocean Agent',
    agentNameHi: 'समुद्र एजेंट',
    toolName: 'ocean_snapshot',
    statusEn: 'Checking ocean conditions',
    statusHi: 'समुद्र की स्थिति जाँची जा रही है',
  },

  // 4. Hazard Agent
  'hazard_agent:check_hazards': {
    agentNameEn: 'Hazard Agent',
    agentNameHi: 'खतरा एजेंट',
    toolName: 'check_hazards',
    statusEn: 'Checking for hazards',
    statusHi: 'समुद्री खतरों की जाँच जारी है',
  },
  'hazard_agent:check_candidate_hazards': {
    agentNameEn: 'Hazard Agent',
    agentNameHi: 'खतरा एजेंट',
    toolName: 'check_hazards',
    statusEn: 'Checking for hazards',
    statusHi: 'समुद्री खतरों की जाँच जारी है',
  },
  hazard_agent: {
    agentNameEn: 'Hazard Agent',
    agentNameHi: 'खतरा एजेंट',
    toolName: 'check_hazards',
    statusEn: 'Checking for hazards',
    statusHi: 'समुद्री खतरों की जाँच जारी है',
  },

  // 5. Route Engine
  'route_service:compare_routes': {
    agentNameEn: 'Route Engine',
    agentNameHi: 'मार्ग इंजन',
    toolName: 'compare_routes',
    statusEn: 'Finding the safest route',
    statusHi: 'सबसे सुरक्षित मार्ग खोजा जा रहा है',
  },
  route_service: {
    agentNameEn: 'Route Engine',
    agentNameHi: 'मार्ग इंजन',
    toolName: 'compare_routes',
    statusEn: 'Finding the safest route',
    statusHi: 'सबसे सुरक्षित मार्ग खोजा जा रहा है',
  },
  'Route Engine': {
    agentNameEn: 'Route Engine',
    agentNameHi: 'मार्ग इंजन',
    toolName: 'compare_routes',
    statusEn: 'Finding the safest route',
    statusHi: 'सबसे सुरक्षित मार्ग खोजा जा रहा है',
  },

  // 6. Explanation Agent
  'explanation_agent:explain_decision': {
    agentNameEn: 'Explanation Agent',
    agentNameHi: 'स्पष्टीकरण एजेंट',
    toolName: 'explain_decision',
    statusEn: 'Putting everything together',
    statusHi: 'संपूर्ण जानकारी तैयार की जा रही है',
  },
  'explanation_agent:converse': {
    agentNameEn: 'Explanation Agent',
    agentNameHi: 'स्पष्टीकरण एजेंट',
    toolName: 'converse',
    statusEn: 'Putting everything together',
    statusHi: 'संपूर्ण जानकारी तैयार की जा रही है',
  },
  explanation_agent: {
    agentNameEn: 'Explanation Agent',
    agentNameHi: 'स्पष्टीकरण एजेंट',
    toolName: 'explain_decision',
    statusEn: 'Putting everything together',
    statusHi: 'संपूर्ण जानकारी तैयार की जा रही है',
  },

  // 7. Web Search Agent (DuckDuckGo Search)
  'web_search_agent:duckduckgo_search': {
    agentNameEn: 'Web Search Agent',
    agentNameHi: 'वेब खोज एजेंट',
    toolName: 'duckduckgo_search',
    statusEn: 'Searching live marine & weather data',
    statusHi: 'लाइव समुद्री एवं मौसम डेटा खोजा जा रहा है',
  },
  'web_search_agent:search_marine_advisories': {
    agentNameEn: 'Web Search Agent',
    agentNameHi: 'वेब खोज एजेंट',
    toolName: 'duckduckgo_search',
    statusEn: 'Searching marine weather advisories',
    statusHi: 'समुद्री मौसम परामर्श खोजे जा रहे हैं',
  },
  web_search_agent: {
    agentNameEn: 'Web Search Agent',
    agentNameHi: 'वेब खोज एजेंट',
    toolName: 'duckduckgo_search',
    statusEn: 'Searching live marine & weather data',
    statusHi: 'लाइव समुद्री एवं मौसम डेटा खोजा जा रहा है',
  },
  'Web Search Agent': {
    agentNameEn: 'Web Search Agent',
    agentNameHi: 'वेब खोज एजेंट',
    toolName: 'duckduckgo_search',
    statusEn: 'Searching live marine & weather data',
    statusHi: 'लाइव समुद्री एवं मौसम डेटा खोजा जा रहा है',
  },

  // Weather Agent
  'weather_agent:weather_snapshot': {
    agentNameEn: 'Weather Agent',
    agentNameHi: 'मौसम एजेंट',
    toolName: 'weather_snapshot',
    statusEn: 'Checking weather conditions',
    statusHi: 'मौसम की स्थिति जाँची जा रही है',
  },
  'weather_agent:conditions_for_location': {
    agentNameEn: 'Weather Agent',
    agentNameHi: 'मौसम एजेंट',
    toolName: 'weather_snapshot',
    statusEn: 'Checking weather conditions',
    statusHi: 'मौसम की स्थिति जाँची जा रही है',
  },
  weather_agent: {
    agentNameEn: 'Weather Agent',
    agentNameHi: 'मौसम एजेंट',
    toolName: 'weather_snapshot',
    statusEn: 'Checking weather conditions',
    statusHi: 'मौसम की स्थिति जाँची जा रही है',
  },

  // Geospatial Agent
  'geospatial_agent:check_candidate_zones': {
    agentNameEn: 'Geospatial Agent',
    agentNameHi: 'भू-स्थानिक एजेंट',
    toolName: 'check_candidate_zones',
    statusEn: 'Verifying marine boundaries',
    statusHi: 'समुद्री सीमाओं की जाँच जारी है',
  },
  'geospatial_agent:check_geofence': {
    agentNameEn: 'Geospatial Agent',
    agentNameHi: 'भू-स्थानिक एजेंट',
    toolName: 'check_geofence',
    statusEn: 'Verifying marine boundaries',
    statusHi: 'समुद्री सीमाओं की जाँच जारी है',
  },
  geospatial_agent: {
    agentNameEn: 'Geospatial Agent',
    agentNameHi: 'भू-स्थानिक एजेंट',
    toolName: 'geofence_lookup',
    statusEn: 'Verifying marine boundaries',
    statusHi: 'समुद्री सीमाओं की जाँच जारी है',
  },

  // Risk / Decision Engine
  'risk_service:analyze_safety': {
    agentNameEn: 'Risk Engine',
    agentNameHi: 'जोखिम इंजन',
    toolName: 'score_candidates',
    statusEn: 'Assessing marine safety & risk',
    statusHi: 'समुद्री सुरक्षा और जोखिम का मूल्यांकन',
  },
  risk_service: {
    agentNameEn: 'Risk Engine',
    agentNameHi: 'जोखिम इंजन',
    toolName: 'score_candidates',
    statusEn: 'Assessing marine safety & risk',
    statusHi: 'समुद्री सुरक्षा और जोखिम का मूल्यांकन',
  },
};

export const DEFAULT_PIPELINE_STEPS = [
  {
    agentKey: 'intent_agent',
    action: 'detect_intent',
    agentNameEn: 'Intent Agent',
    agentNameHi: 'इरादा एजेंट',
    toolName: 'detect_intent',
    statusEn: 'Understanding your request',
    statusHi: 'आपका अनुरोध समझा जा रहा है',
  },
  {
    agentKey: 'pfz_agent',
    action: 'find_candidates',
    agentNameEn: 'PFZ Agent',
    agentNameHi: 'मत्स्य क्षेत्र एजेंट',
    toolName: 'find_candidates',
    statusEn: 'Scanning promising fishing zones',
    statusHi: 'संभावित मत्स्य क्षेत्रों की खोज जारी है',
  },
  {
    agentKey: 'ocean_agent',
    action: 'ocean_snapshot',
    agentNameEn: 'Ocean Agent',
    agentNameHi: 'समुद्र एजेंट',
    toolName: 'ocean_snapshot',
    statusEn: 'Checking ocean conditions',
    statusHi: 'समुद्र की स्थिति जाँची जा रही है',
  },
  {
    agentKey: 'hazard_agent',
    action: 'check_hazards',
    agentNameEn: 'Hazard Agent',
    agentNameHi: 'खतरा एजेंट',
    toolName: 'check_hazards',
    statusEn: 'Checking for hazards',
    statusHi: 'समुद्री खतरों की जाँच जारी है',
  },
  {
    agentKey: 'web_search_agent',
    action: 'duckduckgo_search',
    agentNameEn: 'Web Search Agent',
    agentNameHi: 'वेब खोज एजेंट',
    toolName: 'duckduckgo_search',
    statusEn: 'Searching live marine & weather data',
    statusHi: 'लाइव समुद्री एवं मौसम डेटा खोजा जा रहा है',
  },
  {
    agentKey: 'route_service',
    action: 'compare_routes',
    agentNameEn: 'Route Engine',
    agentNameHi: 'मार्ग इंजन',
    toolName: 'compare_routes',
    statusEn: 'Finding the safest route',
    statusHi: 'सबसे सुरक्षित मार्ग खोजा जा रहा है',
  },
  {
    agentKey: 'explanation_agent',
    action: 'explain_decision',
    agentNameEn: 'Explanation Agent',
    agentNameHi: 'स्पष्टीकरण एजेंट',
    toolName: 'explain_decision',
    statusEn: 'Putting everything together',
    statusHi: 'संपूर्ण जानकारी तैयार की जा रही है',
  },
];

export function resolveAgentStep(
  agent: string,
  action?: string,
  language: AppLanguage = 'en',
): AgentStepDisplay {
  const compositeKey = action ? `${agent}:${action}` : agent;
  const match =
    AGENT_MAPPINGS[compositeKey] ||
    AGENT_MAPPINGS[agent] ||
    (action ? AGENT_MAPPINGS[`*:${action}`] : undefined);

  if (match) {
    return {
      agentName: language === 'hi' ? match.agentNameHi : match.agentNameEn,
      toolName: match.toolName || action || 'agent_tool',
      statusText: language === 'hi' ? match.statusHi : match.statusEn,
    };
  }

  const cleanAgent = agent
    .replace(/_agent$/i, ' Agent')
    .replace(/_service$/i, ' Engine')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    agentName: cleanAgent,
    toolName: action || 'execute',
    statusText: language === 'hi' ? 'कार्य प्रगति पर है' : 'Executing task step',
  };
}

export function AgentThinkingIndicator({ language = 'en' }: { language?: AppLanguage }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1) % DEFAULT_PIPELINE_STEPS.length);
    }, 1300);
    return () => clearInterval(interval);
  }, []);

  const currentStep = DEFAULT_PIPELINE_STEPS[currentStepIndex];
  const isHi = language === 'hi';

  return (
    <div className="agent-thinking-card" role="status" aria-live="polite">
      <div className="agent-thinking-header">
        <div className="agent-thinking-pulse">
          <i />
          <i />
          <i />
        </div>
        <span className="agent-thinking-title">
          {isHi ? 'एजेंट प्रक्रिया सक्रिय है' : 'Multi-Agent Execution'}
        </span>
      </div>

      <div className="agent-thinking-active-step">
        <div className="agent-badge">
          {currentStep.agentKey === 'web_search_agent' ? (
            <Globe size={13} aria-hidden="true" />
          ) : (
            <Bot size={13} aria-hidden="true" />
          )}
          <span>{isHi ? currentStep.agentNameHi : currentStep.agentNameEn}</span>
        </div>
        <div className="tool-badge">
          <Wrench size={11} aria-hidden="true" />
          <code>{currentStep.toolName}</code>
        </div>
        <div className="step-status">
          <strong>{isHi ? currentStep.statusHi : currentStep.statusEn}</strong>
        </div>
      </div>

      <div className="agent-thinking-progress" aria-hidden="true">
        {DEFAULT_PIPELINE_STEPS.map((step, idx) => (
          <span
            key={step.agentKey + step.action}
            className={`progress-pill ${idx === currentStepIndex ? 'active' : idx < currentStepIndex ? 'completed' : ''}`}
            title={isHi ? step.statusHi : step.statusEn}
          />
        ))}
      </div>
    </div>
  );
}

export function AgentChatTrace({
  toolCalls,
  tasks,
  intent,
  language = 'en',
}: {
  toolCalls?: ToolCallTrace[];
  tasks?: Array<{ id: string; agent: string; action: string }>;
  intent?: string;
  language?: AppLanguage;
}) {
  const [expanded, setExpanded] = useState(false);
  const isHi = language === 'hi';

  let steps: AgentStepDisplay[] = [];

  if (toolCalls && toolCalls.length > 0) {
    steps = toolCalls.map((tc) => {
      const resolved = resolveAgentStep(tc.agent, tc.action, language);
      return {
        ...resolved,
        durationMs: tc.duration_ms,
        status: tc.status,
      };
    });
  } else if (tasks && tasks.length > 0) {
    steps = tasks.map((t) => {
      const resolved = resolveAgentStep(t.agent, t.action, language);
      return {
        ...resolved,
        status: 'success',
      };
    });
  } else if (intent === 'general_conversation') {
    steps = [
      resolveAgentStep('intent_agent', 'detect_intent', language),
      resolveAgentStep('web_search_agent', 'duckduckgo_search', language),
      resolveAgentStep('explanation_agent', 'converse', language),
    ];
  } else {
    steps = DEFAULT_PIPELINE_STEPS.map((s) => ({
      agentName: isHi ? s.agentNameHi : s.agentNameEn,
      toolName: s.toolName,
      statusText: isHi ? s.statusHi : s.statusEn,
      status: 'success',
    }));
  }

  const countLabel = isHi
    ? `${steps.length} एजेंट एवं टूल्स निष्पादित`
    : `${steps.length} Agents & Tools Executed`;

  return (
    <div className="agent-trace-container">
      <button
        type="button"
        className={`agent-trace-toggle ${expanded ? 'expanded' : ''}`}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="agent-trace-toggle__badge">
          <Cpu size={13} aria-hidden="true" />
          <span>{countLabel}</span>
        </span>
        <span className="agent-trace-toggle__hint">
          {expanded ? (
            <>
              <span>{isHi ? 'विवरण छुपाएँ' : 'Hide details'}</span>
              <ChevronUp size={14} aria-hidden="true" />
            </>
          ) : (
            <>
              <span>{isHi ? 'टूल्स और एजेंट देखें' : 'View tools & agents'}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </>
          )}
        </span>
      </button>

      {expanded && (
        <div className="agent-trace-drawer">
          <ol className="agent-trace-list">
            {steps.map((step, idx) => (
              <li key={`${step.agentName}-${step.toolName}-${idx}`} className="agent-trace-item">
                <div className="agent-trace-step-number">
                  <span>0{idx + 1}</span>
                </div>
                <div className="agent-trace-content">
                  <div className="agent-trace-badges">
                    <span className="agent-name-tag">
                      {step.agentName.includes('Search') || step.agentName.includes('खोज') ? (
                        <Globe size={12} aria-hidden="true" />
                      ) : (
                        <Bot size={12} aria-hidden="true" />
                      )}
                      {step.agentName}
                    </span>
                    <span className="tool-name-tag">
                      <Wrench size={11} aria-hidden="true" />
                      <code>{step.toolName}</code>
                    </span>
                    {step.durationMs !== undefined && (
                      <span className="duration-tag">
                        <CheckCircle2 size={11} aria-hidden="true" />
                        {Math.round(step.durationMs)}ms
                      </span>
                    )}
                  </div>
                  <p className="agent-status-line">{step.statusText}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
