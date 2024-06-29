import { Capture, Match, Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import { AwsCdkStateMachineStack } from '../lib/aws-cdk-state-machine-stack';

describe('StateMachineStack', () => {
    test('synthesizes the way we expect', () => {
        const app = new cdk.App();

        // Since the StateMachineStack consumes resources from a separate stack
        // (cross-stack references), we create a stack for our SNS topics to live
        // in here. These topics can then be passed to the StateMachineStack later,
        // creating a cross-stack reference.
        const topicsStack = new cdk.Stack(app, 'TopicsStack');

        // Create the topic the stack we're testing will reference.
        const topics = [new sns.Topic(topicsStack, 'Topic1', {})];

        // Create the StateMachineStack.
        const stateMachineStack = new AwsCdkStateMachineStack(app, 'StateMachineStack', {
            topics: topics // Cross-stack reference
        });

        // Prepare the stack for assertions.
        const template = Template.fromStack(stateMachineStack);

        // Assert it creates the function with the correct properties...
        template.hasResourceProperties('AWS::Lambda::Function', {
            Handler: 'handler',
            Runtime: 'nodejs14.x'
        });

        // Creates the subscription...
        template.resourceCountIs('AWS::SNS::Subscription', 1);

        // Fully assert on the state machine's IAM role with matchers.
        template.hasResourceProperties(
            'AWS::IAM::Role',
            Match.objectEquals({
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Action: 'sts:AssumeRole',
                            Effect: 'Allow',
                            Principal: {
                                Service: {
                                    'Fn::Join': [
                                        '',
                                        ['states.', Match.anyValue(), '.amazonaws.com']
                                    ]
                                }
                            }
                        }
                    ]
                }
            })
        );

        // Assert on the state machine's definition with the Match.serializedJson()
        // matcher.
        template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
            DefinitionString: Match.serializedJson(
                // Match.objectEquals() is used implicitly, but we use it explicitly
                // here for extra clarity.
                Match.objectEquals({
                    StartAt: 'StartState',
                    States: {
                        StartState: {
                            Type: 'Pass',
                            End: true,
                            // Make sure this state doesn't provide a next state -- we can't
                            // provide both Next and set End to true.
                            Next: Match.absent()
                        }
                    }
                })
            )
        });

        // Capture some data from the state machine's definition.
        const startAtCapture = new Capture();
        const statesCapture = new Capture();
        template.hasResourceProperties("AWS::StepFunctions::StateMachine", {
            DefinitionString: Match.serializedJson(
                Match.objectLike({
                    StartAt: startAtCapture,
                    States: statesCapture,
                })
            ),
        });

        // Assert that the start state starts with "Start".
        expect(startAtCapture.asString()).toEqual(expect.stringMatching(/^Start/));

        // Assert that the start state actually exists in the states object of the
        // state machine definition.
        expect(statesCapture.asObject()).toHaveProperty(startAtCapture.asString());


    });
});